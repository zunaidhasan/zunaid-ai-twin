"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Starfield, { moodForTopic, type Mood } from "@/components/Starfield";
import Avatar, { type AvatarState } from "@/components/Avatar";
import ChatBubble, { type BubbleMsg } from "@/components/ChatBubble";
import SuggestedChips from "@/components/SuggestedChips";
import MessageInput from "@/components/MessageInput";
import SettingsPanel, { THEMES, type ThemeId } from "@/components/SettingsPanel";
import { generateReply, greetingReply, type Tone } from "@/lib/engine";
import { isLlmEnabled } from "@/lib/llm";
import { loadHistory, saveHistory, clearHistory, recordMessage, type Msg } from "@/lib/memory";
import { speak, stopSpeaking, loadVoices } from "@/lib/voice";
import { buildShareUrl, trimToShareable, type ShareMsg } from "@/lib/share";
import { recordEvent } from "@/lib/analytics";
import { identity, stats } from "@/lib/knowledge";

type Settings = {
  theme: ThemeId;
  tone: Tone;
  voiceOn: boolean;
  voiceName: string; // "" = auto-pick; otherwise an exact SpeechSynthesis voice name
  handsFree: boolean; // mic reopens automatically after every spoken reply
};

const DEFAULTS: Settings = { theme: "studio", tone: "auto", voiceOn: false, voiceName: "", handsFree: false };
const KEY = "ztwin.settings.v1";

/** Streams text into a message id, revealing chunk-by-chunk. */
function useStreamer() {
  const [visible, setVisible] = useState<Record<string, string>>({});
  const timers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const stream = useCallback((id: string, full: string, onDone: () => void) => {
    let i = 0;
    const step = Math.max(2, Math.round(full.length / 90)); // ~90 ticks max
    const t = setInterval(() => {
      i += step;
      setVisible((v) => ({ ...v, [id]: full.slice(0, i) }));
      if (i >= full.length) {
        clearInterval(t);
        delete timers.current[id];
        onDone();
      }
    }, 18);
    timers.current[id] = t;
  }, []);

  const stop = useCallback((id: string, full: string) => {
    if (timers.current[id]) {
      clearInterval(timers.current[id]);
      delete timers.current[id];
    }
    setVisible((v) => ({ ...v, [id]: full }));
  }, []);

  return { visible, stream, stop };
}

export default function Home() {
  /* ---------------------------- state ---------------------------- */
  const [msgs, setMsgs] = useState<BubbleMsg[]>([]);
  const [avatarState, setAvatarState] = useState<"idle" | "thinking" | "speaking">("idle");
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [banglaActive, setBanglaActive] = useState(false);
  const [mood, setMood] = useState<Mood>({ hue: 200 });
  const [busy, setBusy] = useState(false);
  const [llmOn, setLlmOn] = useState(false);
  const [micListening, setMicListening] = useState(false);
  const [poked, setPoked] = useState(false);

  const logRef = useRef<HTMLDivElement>(null);
  const bootedRef = useRef(false);
  const streamer = useStreamer();
  // MessageInput registers its mic starter here so hands-free mode can reopen
  // the mic after each spoken reply (true voice conversation loop).
  const micHandleRef = useRef<(() => void) | null>(null);

  /* ------------------------ boot: history ------------------------ */
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;

    try {
      const s = localStorage.getItem(KEY);
      if (s) setSettings({ ...DEFAULTS, ...(JSON.parse(s) as Settings) });
    } catch { /* noop */ }

    const saved = loadHistory();
    if (saved.length) {
      setMsgs(
        saved.map((m: Msg) => ({
          id: m.id,
          role: m.role,
          text: m.text,
          payload: m.payload as BubbleMsg["payload"],
        }))
      );
      logRef.current?.scrollTo({ top: 1e6 });
    } else {
      const g = greetingReply();
      setMsgs([{ id: "greet", role: "twin", text: g.text, payload: g.payload }]);
    }
    setLlmOn(isLlmEnabled());
    void loadVoices();
  }, []);

  /* --------------------- persist settings ------------------------ */
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch { /* noop */ }
    document.documentElement.setAttribute("data-theme", settings.theme);
  }, [settings]);

  /* ------------------------- autoscroll -------------------------- */
  useEffect(() => {
    logRef.current?.scrollTo({ top: 1e6, behavior: "smooth" });
  }, [msgs.length, streamer.visible]);

  /* -------------------------- helpers ---------------------------- */
  const uid = () => `m${Date.now()}${Math.random().toString(36).slice(2, 7)}`;

  // Twin's speech amplitude (0..1) → CSS vars consumed by the avatar glow
  // (.voice-glow, lip-sync bars) and the input-bar wave (.wave-live glow).
  // Written straight to <html> so no React re-render happens at 60fps.
  const handleTwinAmplitude = useCallback((level: number) => {
    const root = document.documentElement;
    root.style.setProperty("--twin-level", level.toFixed(3));
    root.style.setProperty("--wave-level", level.toFixed(3));
  }, []);

  const pushTwin = useCallback((reply: ReturnType<typeof generateReply>, userText: string) => {
    const id = uid();
    setMsgs((m) => [...m, { id, role: "twin", text: "", payload: reply.payload }]);
    setAvatarState("thinking");

    streamer.stream(id, reply.text, () => {
      setAvatarState(settings.voiceOn ? "speaking" : "idle");
      if (settings.voiceOn) {
        speak(reply.text, {
          lang: reply.lang === "bn" ? "bn" : "en",
          voiceName: settings.voiceName || undefined,
          onStart: () => setAvatarState("speaking"),
          onAmplitude: handleTwinAmplitude,
          onEnd: () => {
            setAvatarState("idle");
            if (settings.handsFree) {
              // Voice loop: once the reply finishes speaking, reopen the mic.
              window.setTimeout(() => micHandleRef.current?.(), 600);
            }
          },
        });
      } else if (settings.handsFree) {
        // Hands-free without voice replies: reopen the mic after streaming ends.
        window.setTimeout(() => micHandleRef.current?.(), 600);
      }
      setMood(moodForTopic(reply.text));
      // Persist with full text + payload.
      setMsgs((cur) => {
        const next = cur.map((m) => (m.id === id ? { ...m, text: reply.text } : m));
        saveHistory(next.map((m) => ({ id: m.id, role: m.role, text: m.text, ts: Date.now(), payload: m.payload, lang: reply.lang })));
        return next;
      });
    });

    if (userText) {
      const topics = userText.toLowerCase();
      if (/bangla mode|বাংলা/.test(topics)) setBanglaActive(true);
      if (/english mode/.test(topics)) setBanglaActive(false);
    }
  }, [settings.voiceOn, settings.voiceName, settings.handsFree, streamer, handleTwinAmplitude]);

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;
      setBusy(true);
      stopSpeaking();

      const userMsg: BubbleMsg = { id: uid(), role: "user", text };
      setMsgs((m) => {
        const next = [...m, userMsg];
        recordMessage({ id: userMsg.id, role: "user", text, ts: Date.now() });
        saveHistory(next.map((x) => ({ id: x.id, role: x.role, text: x.text, ts: Date.now() })));
        return next;
      });

      // "share" command needs history AFTER the share bubble is added; handled in onShare.

      if (isLlmEnabled()) {
        // ⚙️ PLUG-IN POINT: LLM path — rule engine still covers commands.
        void (async () => {
          try {
            const res = await fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messages: [...msgs, userMsg].slice(-12).map((m) => ({ role: m.role === "twin" ? "assistant" : "user", content: m.text })),
                tone: settings.tone,
                lang: banglaActive ? "bn" : "auto",
              }),
            });
            const data = (await res.json()) as { ok: boolean; text?: string };
            if (data.ok && data.text) {
              pushTwin({ text: data.text, lang: banglaActive ? "bn" : "en" }, text);
              return;
            }
          } catch { /* fall through to engine */ }
          const r = generateReply(text, { tone: settings.tone, history: msgs as Msg[], langLock: banglaActive ? "bn" : null });
          pushTwin(r, text);
        })();
      } else {
        // Small human-like pause before the engine answers.
        setTimeout(() => {
          const r = generateReply(text, { tone: settings.tone, history: msgs as Msg[], langLock: banglaActive ? "bn" : null });
          pushTwin(r, text);
        }, 420);
      }

      // Release busy once the twin bubble finishes streaming (approx): 
      setTimeout(() => setBusy(false), 600);
    },
    [busy, msgs, settings.tone, banglaActive, pushTwin]
  );

  const onShare = useCallback((): string => {
    const shareMsgs: ShareMsg[] = msgs
      .filter((m) => m.text)
      .map((m) => ({ role: m.role, text: m.text }));
    return buildShareUrl(trimToShareable(shareMsgs));
  }, [msgs]);

  const reset = () => {
    clearHistory();
    stopSpeaking();
    const g = greetingReply();
    setMsgs([{ id: "greet", role: "twin", text: g.text, payload: g.payload }]);
    setSettingsOpen(false);
  };

  /* ---------------------------- view ----------------------------- */
  // Avatar display state — listening wins (it means the mic is open right now).
  const displayState: AvatarState = micListening ? "listening" : avatarState;

  const pokeAvatar = () => {
    setPoked(true);
    if (!busy && msgs.length <= 1) send("hello 👋"); // first poke breaks the ice
  };

  return (
    <main className="flex h-dvh flex-col">
      <Starfield mood={mood} />

      {/* Header */}
      <header
        className="z-10 flex items-center gap-3 px-4 py-3 backdrop-blur-md sm:px-6"
        style={{ background: "color-mix(in srgb, var(--bg) 55%, transparent)", borderBottom: "1px solid var(--line)" }}
      >
        <Avatar state={displayState} size={64} showStatus={false} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[17px] font-semibold leading-tight" style={{ color: "var(--text)" }}>
            Zunaid Hasan <span style={{ color: "var(--accent)" }}>· AI Twin</span>
          </h1>
          <p className="truncate text-[12px]" style={{ color: "var(--muted)" }}>
            {displayState === "thinking" ? "thinking…" : displayState === "speaking" ? "speaking…" : displayState === "listening" ? "listening — go ahead…" : `${identity.tagline} · ${identity.location} 🇧🇩`}
          </p>
        </div>
        <a href={identity.portfolio} target="_blank" rel="noopener noreferrer" className="btn-ghost hidden !py-1.5 text-[12.5px] sm:inline-flex">
          🌐 Portfolio
        </a>
        <a href={identity.github} target="_blank" rel="noopener noreferrer" className="btn-ghost hidden !py-1.5 text-[12.5px] sm:inline-flex">
          🐙 GitHub
        </a>
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Open settings"
          className="flex h-9 w-9 items-center justify-center rounded-xl transition"
          style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}
        >
          ⚙️
        </button>
      </header>

      {/* Hero — big interactive avatar; collapses once the conversation starts */}
      <AnimatePresence>
        {msgs.length <= 2 && (
          <motion.section
            key="hero"
            aria-label="Introduction"
            className="z-10 flex flex-col items-center gap-2.5 px-4 pt-5 text-center"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -18, height: 0, paddingTop: 0, paddingBottom: 0, transition: { duration: 0.4, ease: "easeInOut" } }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <Avatar state={displayState} size={196} showStatus={false} interactive onPoke={pokeAvatar} />
            <h2 className="font-display text-[24px] font-semibold leading-tight" style={{ color: "var(--text)" }}>
              {identity.name}
            </h2>
            <p className="max-w-md text-[13.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>
              {identity.tagline} — {identity.location} 🇧🇩
            </p>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {stats.slice(0, 4).map((s) => (
                <span
                  key={s.label}
                  className="rounded-full px-2.5 py-1 text-[11.5px]"
                  style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--text-2)" }}
                >
                  <strong style={{ color: "var(--accent)" }}>{s.value}</strong> {s.label}
                </span>
              ))}
            </div>
            <p className="mt-0.5 animate-pulse text-[11.5px]" style={{ color: "var(--muted)" }} aria-hidden>
              {poked ? "let's talk 👇" : "👆 poke me — or just start typing"}
            </p>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Chat log */}
      <div id="chat-log" ref={logRef} className="flex-1 overflow-y-auto px-3 py-4 sm:px-5" role="log" aria-live="polite" aria-label="Conversation with Zunaid's AI Twin">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {msgs.map((m, idx) => {
            const partial = streamer.visible[m.id];
            const isStreaming = m.text === "" || (typeof partial === "string" && partial.length < m.text.length);
            const text = typeof partial === "string" ? (isStreaming ? partial : m.text) : m.text;
            return (
              <ChatBubble
                key={m.id}
                msg={{ ...m, text }}
                streaming={isStreaming}
                onChip={(c) => send(c)}
                onContact={() => send("contact")}
                onLeaveMessage={() => send("leave a message")}
                onShare={onShare}
              />
            );
          })}
          <AnimatePresence>
            {busy && avatarState === "thinking" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-2 px-1 text-[12px]" style={{ color: "var(--muted)" }}>
                <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--accent)" }} />
                the twin is thinking…
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Chips + input */}
      <div className="z-10 backdrop-blur-md" style={{ background: "color-mix(in srgb, var(--bg) 55%, transparent)" }}>
        <SuggestedChips onPick={send} visible={msgs.length <= 1} />
        <MessageInput
          onSend={send}
          disabled={busy}
          banglaActive={banglaActive}
          handsFree={settings.handsFree}
          micHandleRef={micHandleRef}
          onListeningChange={setMicListening}
          streaming={avatarState !== "idle"}
        />
      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        theme={settings.theme}
        setTheme={(t) => setSettings((s) => ({ ...s, theme: t }))}
        tone={settings.tone}
        setTone={(t) => setSettings((s) => ({ ...s, tone: t as Tone }))}
        voiceOn={settings.voiceOn}
        setVoiceOn={(v) => {
          setSettings((s) => ({ ...s, voiceOn: v }));
          recordEvent("voice_reply_toggled", { on: v });
          if (!v) stopSpeaking();
        }}
        voiceName={settings.voiceName}
        setVoiceName={(v) => setSettings((s) => ({ ...s, voiceName: v }))}
        handsFree={settings.handsFree}
        setHandsFree={(v) => setSettings((s) => ({ ...s, handsFree: v }))}
        onReset={reset}
        llmEnabled={llmOn}
      />
    </main>
  );
}
