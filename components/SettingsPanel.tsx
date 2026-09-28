"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { listVoices, loadVoices, speak, stopSpeaking } from "@/lib/voice";

export type ToneOption = { id: string; label: string; emoji: string };
export const TONE_OPTIONS: ToneOption[] = [
  { id: "auto", label: "Auto-detect", emoji: "✨" },
  { id: "formal", label: "Formal", emoji: "🎩" },
  { id: "casual", label: "Casual", emoji: "😄" },
  { id: "technical", label: "Technical", emoji: "⚙️" },
  { id: "bangla", label: "Bangla", emoji: "🇧🇩" },
];

export type ThemeId = "studio" | "green" | "terminal" | "light";

export const THEMES: { id: ThemeId; label: string; dot: string }[] = [
  { id: "studio", label: "Studio Dark", dot: "#7c6cff" },
  { id: "green", label: "Bangladesh Green", dot: "#00a862" },
  { id: "terminal", label: "Neon Terminal", dot: "#22c55e" },
  { id: "light", label: "Minimal Light", dot: "#f59e0b" },
];

/**
 * Settings drawer: theme switcher, tone modes, voice controls, memory reset.
 * Voice section includes the output-voice picker (with live preview) and the
 * hands-free conversation toggle (mic reopens after every spoken reply).
 */
export default function SettingsPanel({
  open,
  onClose,
  theme,
  setTheme,
  tone,
  setTone,
  voiceOn,
  setVoiceOn,
  voiceName,
  setVoiceName,
  handsFree,
  setHandsFree,
  onReset,
  llmEnabled,
}: {
  open: boolean;
  onClose: () => void;
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  tone: string;
  setTone: (t: string) => void;
  voiceOn: boolean;
  setVoiceOn: (v: boolean) => void;
  voiceName: string;
  setVoiceName: (v: string) => void;
  handsFree: boolean;
  setHandsFree: (v: boolean) => void;
  onReset: () => void;
  llmEnabled: boolean;
}) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Load the browser voice list when the drawer opens (async in Chrome).
  useEffect(() => {
    if (!open) return;
    const existing = listVoices();
    if (existing.length) {
      setVoices(existing);
      return;
    }
    let alive = true;
    void loadVoices().then((v) => {
      if (alive) setVoices(v);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  const { bnVoices, enVoices, otherVoices } = useMemo(
    () => ({
      bnVoices: voices.filter((v) => /^bn([-_]|$)/i.test(v.lang)),
      enVoices: voices.filter((v) => /^en([-_]|$)/i.test(v.lang)),
      otherVoices: voices.filter((v) => !/^bn([-_]|$)/i.test(v.lang) && !/^en([-_]|$)/i.test(v.lang)),
    }),
    [voices]
  );

  const previewVoice = () => {
    const v = voices.find((x) => x.name === voiceName);
    const lang: "bn" | "en" = v && /^bn([-_]|$)/i.test(v.lang) ? "bn" : "en";
    speak(
      lang === "bn" ? "আসসালামু আলাইকুম! আমি জুনাইদের এআই টুইন।" : "Hi! I'm Zunaid's AI twin — production AI, not demos.",
      { lang, voiceName: voiceName || undefined }
    );
  };
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,0.45)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            aria-hidden
          />
          <motion.aside
            role="dialog"
            aria-label="Settings"
            className="fixed bottom-0 right-0 top-0 z-50 w-[min(88vw,340px)] overflow-y-auto p-5"
            style={{ background: "var(--surface)", borderLeft: "1px solid var(--line)" }}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>Settings</h2>
              <button onClick={onClose} aria-label="Close settings" className="rounded-lg px-2 py-1 text-lg" style={{ color: "var(--muted)" }}>✕</button>
            </div>

            {/* Theme */}
            <section aria-labelledby="theme-h">
              <h3 id="theme-h" className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Theme</h3>
              <div className="grid grid-cols-2 gap-2">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] transition"
                    style={{
                      background: theme === t.id ? "var(--surface-2)" : "transparent",
                      border: `1px solid ${theme === t.id ? "var(--accent)" : "var(--line)"}`,
                      color: "var(--text-2)",
                    }}
                    aria-pressed={theme === t.id}
                  >
                    <span className="h-3 w-3 rounded-full" style={{ background: t.dot }} aria-hidden />
                    {t.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Tone */}
            <section aria-labelledby="tone-h" className="mt-6">
              <h3 id="tone-h" className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Tone mode</h3>
              <div className="flex flex-wrap gap-2">
                {TONE_OPTIONS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTone(t.id)}
                    className="rounded-full px-3 py-1.5 text-[12.5px] transition"
                    style={{
                      background: tone === t.id ? "var(--accent)" : "var(--surface-2)",
                      color: tone === t.id ? "#fff" : "var(--text-2)",
                      border: "1px solid var(--line)",
                    }}
                    aria-pressed={tone === t.id}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Voice */}
            <section aria-labelledby="voice-h" className="mt-6">
              <h3 id="voice-h" className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Voice</h3>
              <button
                onClick={() => setVoiceOn(!voiceOn)}
                role="switch"
                aria-checked={voiceOn}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[13px]"
                style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--text-2)" }}
              >
                <span>🔊 Voice replies</span>
                <span className="relative h-5 w-9 rounded-full transition" style={{ background: voiceOn ? "var(--accent)" : "var(--line)" }}>
                  <span
                    className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
                    style={{ left: voiceOn ? 18 : 2 }}
                  />
                </span>
              </button>

              {/* Output voice picker */}
              <div className="mt-2 rounded-xl px-3 py-2.5" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
                <label htmlFor="voice-select" className="block text-[12px] font-medium" style={{ color: "var(--text-2)" }}>
                  🗣️ Reply voice
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <select
                    id="voice-select"
                    value={voiceName}
                    onChange={(e) => setVoiceName(e.target.value)}
                    disabled={!voiceOn}
                    className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-[12.5px] outline-none disabled:opacity-50"
                    style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text)" }}
                  >
                    <option value="">Auto — smart pick</option>
                    {bnVoices.length > 0 && (
                      <optgroup label="Bangla">
                        {bnVoices.map((v) => (
                          <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                        ))}
                      </optgroup>
                    )}
                    {enVoices.length > 0 && (
                      <optgroup label="English">
                        {enVoices.map((v) => (
                          <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                        ))}
                      </optgroup>
                    )}
                    {otherVoices.length > 0 && (
                      <optgroup label="Other">
                        {otherVoices.map((v) => (
                          <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  <button
                    onClick={previewVoice}
                    disabled={!voiceOn}
                    aria-label="Preview selected voice"
                    title="Preview voice"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[13px] transition disabled:opacity-40"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    ▶
                  </button>
                </div>
                {voices.length === 0 && (
                  <p className="mt-1.5 text-[11px]" style={{ color: "var(--muted)" }}>
                    Loading available voices…
                  </p>
                )}
              </div>

              {/* Hands-free conversation */}
              <button
                onClick={() => setHandsFree(!handsFree)}
                role="switch"
                aria-checked={handsFree}
                className="mt-2 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-[13px]"
                style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--text-2)" }}
              >
                <span>🎤 Hands-free conversation</span>
                <span className="relative h-5 w-9 rounded-full transition" style={{ background: handsFree ? "var(--accent)" : "var(--line)" }}>
                  <span
                    className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
                    style={{ left: handsFree ? 18 : 2 }}
                  />
                </span>
              </button>

              <p className="mt-1.5 text-[11.5px] leading-relaxed" style={{ color: "var(--muted)" }}>
                {handsFree
                  ? "Full voice loop: speak → the twin replies out loud → mic reopens. Mic input requires Chrome/Edge."
                  : "Voice replies use your browser's built-in voices. Press the mic to talk — your words send themselves."}
                {/* ⚙️ Plug real voice cloning (ElevenLabs) in lib/voice.ts */}
              </p>
            </section>

            {/* Brain */}
            <section aria-labelledby="brain-h" className="mt-6">
              <h3 id="brain-h" className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Brain</h3>
              <div className="rounded-xl px-3 py-2.5 text-[12.5px]" style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--text-2)" }}>
                {llmEnabled ? (
                  <>🧠 Hybrid mode: <strong>LLM connected</strong> — rule-based fallback active.</>
                ) : (
                  <>🧠 Running on the built-in knowledge engine. <span style={{ color: "var(--muted)" }}>Add an LLM key to level up (see README).</span></>
                )}
              </div>
            </section>

            {/* Memory */}
            <section aria-labelledby="mem-h" className="mt-6">
              <h3 id="mem-h" className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Memory</h3>
              <button
                onClick={onReset}
                className="w-full rounded-xl px-3 py-2.5 text-[13px] transition hover:opacity-80"
                style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "#f87171" }}
              >
                ↺ Forget our conversation
              </button>
            </section>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
