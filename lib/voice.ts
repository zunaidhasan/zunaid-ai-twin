/**
 * Voice helpers — browser SpeechSynthesis (TTS) + SpeechRecognition (STT).
 *
 * TTS strategy:
 *   1. Prefer a Bangla voice (bn-BD / bn-IN) when the reply is Bangla.
 *   2. Otherwise prefer high-quality English voices (Google UK English Female,
 *      Samantha, Google US English) — good EN + BN coverage with zero CDN cost.
 *   3. Fallback: whatever the OS offers.
 *
 * ⚙️ PLUG-IN POINT (voice cloning / premium TTS): swap the internals of
 * `speak()` for ElevenLabs (`/v1/text-to-speech/{voice_id}` with
 * model=eleven_multilingual_v2 handles Bangla + English), or Retell AI /
 * Azure TTS which DeshVox already uses. Keep the same function signature —
 * the UI only calls speak(text, lang) / stopSpeaking() / speaking state.
 */

export type VoiceLang = "bn" | "en";

/**
 * Latest twin speech amplitude (0..1), updated ~16×/s while the twin speaks
 * and reset to 0 when it stops. Visual systems (starfield, avatar glow) read
 * this directly in their animation loops — no props, no events, no re-renders.
 */
export const twinLevel = { current: 0 };

let voicesCache: SpeechSynthesisVoice[] = [];
let currentUtterance: SpeechSynthesisUtterance | null = null;
let ampTimer: ReturnType<typeof setInterval> | null = null;

/** Stops any running amplitude simulation and reports level 0. */
function stopAmplitude(onAmplitude?: (level: number) => void) {
  if (ampTimer) {
    clearInterval(ampTimer);
    ampTimer = null;
  }
  twinLevel.current = 0;
  onAmplitude?.(0);
}

/** Normalizes the many browser quirks around voice list loading. */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return resolve([]);
    const grab = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length) {
        voicesCache = v;
        resolve(v);
        return true;
      }
      return false;
    };
    if (grab()) return;
    let tries = 0;
    const t = setInterval(() => {
      if (grab() || ++tries > 20) clearInterval(t);
      if (tries > 20) resolve([]);
    }, 150);
    window.speechSynthesis.onvoiceschanged = () => grab();
  });
}

function pickVoice(lang: VoiceLang, voiceName?: string): SpeechSynthesisVoice | null {
  if (!voicesCache.length) return null;
  const bangla = voicesCache.filter((v) => /^bn([-_]|$)/i.test(v.lang));
  const en = voicesCache.filter((v) => /^en([-_]|$)/i.test(v.lang));

  // User's explicit pick (from Settings) wins — fall back to auto if it vanished.
  if (voiceName) {
    const exact = voicesCache.find((v) => v.name === voiceName);
    if (exact) return exact;
  }

  if (lang === "bn") {
    // bn-BD first, then any Bangla voice; else fall through to English.
    return bangla.find((v) => /bn[-_]bd/i.test(v.lang)) || bangla[0] || null;
  }
  const preferredEn = [
    /Google UK English Female/i,
    /Google US English/i,
    /Samantha/i,
    /Microsoft (Aria|Zira|Jenny)/i,
    /Google UK English Male/i,
  ];
  for (const rx of preferredEn) {
    const hit = en.find((v) => rx.test(v.name));
    if (hit) return hit;
  }
  return en[0] || null;
}

export type SpeakOptions = {
  lang: VoiceLang;
  rate?: number;
  pitch?: number;
  voiceName?: string; // explicit voice picked in Settings ("auto"/undefined = smart pick)
  onStart?: () => void;
  onEnd?: () => void;
  /** Fake-but-convincing amplitude envelope (0..1) synced to word boundaries.
   *  SpeechSynthesis gives no real audio tap, so we re-energize on each spoken
   *  word and decay between them — UI glow then follows the speech cadence. */
  onAmplitude?: (level: number) => void;
};

export function speak(text: string, opts: SpeakOptions) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    opts.onEnd?.();
    return;
  }
  stopSpeaking();

  // Strip markdown / emoji noise so the voice reads naturally.
  const clean = text
    .replace(/```[\s\S]*?```/g, " code block ")
    .replace(/[*_`#>]/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600); // keep utterances snappy

  const u = new SpeechSynthesisUtterance(clean);
  const voice = pickVoice(opts.lang, opts.voiceName);
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else {
    u.lang = opts.lang === "bn" ? "bn-BD" : "en-US";
  }
  u.rate = opts.rate ?? (opts.lang === "bn" ? 0.95 : 1.02);
  u.pitch = opts.pitch ?? 1;
  currentUtterance = u;
  u.onstart = () => opts.onStart?.();

  // Amplitude envelope: energize on word boundaries, exponential decay between.
  if (opts.onAmplitude) {
    let envelope = 0;
    u.onboundary = () => {
      envelope = Math.min(1, envelope + 0.55); // new word → burst of energy
    };
    const started = Date.now();
    stopAmplitude(opts.onAmplitude);
    ampTimer = setInterval(() => {
      envelope *= 0.88; // decay between words
      const t = Date.now() - started;
      const wobble = 0.14 + 0.1 * Math.sin(t / 260); // speech-like baseline
      const level = Math.max(0, Math.min(1, wobble + envelope));
      twinLevel.current = level;
      opts.onAmplitude?.(level);
    }, 60);
  }

  u.onend = () => {
    currentUtterance = null;
    stopAmplitude(opts.onAmplitude);
    opts.onEnd?.();
  };
  u.onerror = () => {
    currentUtterance = null;
    stopAmplitude(opts.onAmplitude);
    opts.onEnd?.();
  };
  window.speechSynthesis.speak(u);
}

/** The currently available TTS voices (may be empty until the browser loads them). */
export function listVoices(): SpeechSynthesisVoice[] {
  if (typeof window !== "undefined" && "speechSynthesis" in window && !voicesCache.length) {
    const v = window.speechSynthesis.getVoices();
    if (v.length) voicesCache = v;
  }
  return voicesCache;
}

export function stopSpeaking() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  currentUtterance = null;
  if (ampTimer) {
    clearInterval(ampTimer);
    ampTimer = null;
  }
}

export function isSpeaking() {
  return currentUtterance !== null;
}

/* ------------------------------------------------------------------ */
/*  Speech input (mic)                                                 */
/* ------------------------------------------------------------------ */

type SR = {
  new (): SpeechRecognitionLike;
};
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> & { length: number } }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
}

export function speechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/**
 * Starts one-shot dictation. Returns a cancel function.
 * lang: "bn-BD" for Bangla capture, "en-US" otherwise —
 * browsers recognize Banglish far better when told bn-BD.
 *
 * Error contract: onError receives the RAW SpeechRecognition error code
 * ("not-allowed", "no-speech", "aborted", …) — exactly one per session.
 * "aborted" = the user stopped the mic deliberately → reported as "" so
 * callers can ignore it. UI layers own the friendly wording.
 */
export function listenOnce(
  lang: VoiceLang,
  onTranscript: (text: string) => void,
  onEnd?: () => void,
  onError?: (err: string) => void
): () => void {
  const w = window as unknown as Record<string, SR | undefined>;
  const Ctor = (w.SpeechRecognition || w.webkitSpeechRecognition) as SR | undefined;
  if (!Ctor) {
    onError?.("unsupported");
    onEnd?.();
    return () => {};
  }
  const rec = new Ctor();
  const requestedBn = lang === "bn";
  rec.lang = requestedBn ? "bn-BD" : "en-US";
  rec.continuous = false;
  rec.interimResults = true;
  let finalText = "";
  let settled = false;

  rec.onresult = (e) => {
    let interim = "";
    for (let i = 0; i < e.results.length; i++) {
      const r = e.results[i] as ArrayLike<{ transcript: string }> & { isFinal?: boolean };
      const t = r[0].transcript;
      if (r.isFinal) finalText += t;
      else interim += t;
    }
    onTranscript(finalText + interim);
  };
  rec.onend = () => {
    // Bangla requested but no bn recognizer in this browser/OS → retry in
    // English once (it still handles Banglish surprisingly well).
    if (requestedBn && !finalText.trim() && !settled) {
      settled = true;
      listenOnce("en", onTranscript, onEnd, onError);
      return;
    }
    if (finalText.trim()) onTranscript(finalText.trim());
    onEnd?.();
  };
  rec.onerror = (e) => {
    const code = (e as { error?: string })?.error || "unknown";
    if (code === "aborted") return; // deliberate stop — onend handles cleanup
    if (settled) return;
    settled = true;
    onError?.(code); // RAW code — UI maps it to friendly text
    onEnd?.();
  };

  try {
    rec.start();
  } catch {
    if (!settled) {
      settled = true;
      onError?.("start-failed");
      onEnd?.();
    }
  }
  return () => {
    try {
      rec.stop();
    } catch {
      /* noop */
    }
  };
}
