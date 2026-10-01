"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Starfield, { moodForTopic, type Mood } from "@/components/Starfield";
import Avatar, { type AvatarState } from "@/components/Avatar";
import ChatBubble, { type BubbleMsg } from "@/components/ChatBubble";
import SuggestedChips from "@/components/SuggestedChips";
import MessageInput from "@/components/MessageInput";
import SideRail from "@/components/SideRail";
import AvailabilityCTA from "@/components/AvailabilityCTA";
import SettingsPanel, { type ThemeId } from "@/components/SettingsPanel";
import { generateReply, greetingReply, tryCommand, type Tone } from "@/lib/engine";
import { isLlmEnabled } from "@/lib/llm";
import { loadHistory, saveHistory, clearHistory, recordMessage, getName, type Msg } from "@/lib/memory";
import { speak, stopSpeaking, loadVoices } from "@/lib/voice";
import { buildShareUrl, trimToShareable, type ShareMsg } from "@/lib/share";
import { recordEvent } from "@/lib/analytics";
import { identity, stats } from "@/lib/knowledge";
import { useStreamer } from "@/hooks/useStreamer";

type Settings = {
  theme: ThemeId;
  tone: Tone;
  voiceOn: boolean;
  voiceName: string; // "" = auto-pick; otherwise an exact SpeechSynthesis voice name
  handsFree: boolean; // mic reopens automatically after every spoken reply
};

const DEFAULTS: Settings = { theme: "studio", tone: "auto", voiceOn: false, voiceName: "", handsFree: false };
const KEY = "ztwin.settings.v1";

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
  const [hydrated, setHydrated] = useState(false);
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
    setHydrated(true);
  }, []);

  /* --------------------- persist settings ------------------------ */
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch { /* noop */ }
    document.documentElement.setAttribute("data-theme", settings.theme);
  }, [settings, hydrated]);

  useEffect(() => {
    document.documentElement.lang = banglaActive ? "bn" : "en";
  }, [banglaActive]);

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
      setBusy(false);
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
        saveHistory(next.map((x) => ({ id: x.id, role: x.role, text: x.text, ts: Date.now(), payload: x.payload })));
        return next;
      });

      const ctx = { tone: settings.tone, history: msgs as Msg[], langLock: banglaActive ? ("bn" as const) : null };
      const cmd = tryCommand(text, ctx);
      if (cmd) {
        setTimeout(() => pushTwin(cmd, text), 420);
      } else if (isLlmEnabled()) {
        void (async () => {
          try {
            const res = await fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messages: [...msgs, userMsg].slice(-12).map((m) => ({ role: m.role === "twin" ? "assistant" : "user", content: m.text })),
                tone: settings.tone,
                lang: banglaActive ? "bn" : "auto",
                userName: getName() || undefined,
              }),
            });
            const data = (await res.json()) as { ok: boolean; text?: string };
            if (data.ok && data.text) {
              pushTwin({ text: data.text, lang: banglaActive ? "bn" : "en" }, text);
              return;
            }
          } catch { /* fall through to engine */ }
          try {
            pushTwin(generateReply(text, ctx), text);
          } catch {
            setBusy(false);
          }
        })();
      } else {
        setTimeout(() => pushTwin(generateReply(text, ctx), text), 420);
      }
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
  // Empty = greeting only, no user turn yet. First real message triggers the
  // empty → active transition (hero collapses, stream becomes the surface).
  const isEmpty = msgs.length <= 1 && !busy;
  const userTurns = msgs.filter((m) => m.role === "user").length;

  // Projects touched by the conversation → side rail, in discussion order.
  const railProjects = msgs
    .flatMap((m) => {
      const ids: string[] = [];
      if (m.payload?.kind === "project") ids.push(m.payload.projectId);
      return ids;
    })
    .filter((id, i, arr) => arr.indexOf(id) === i);

  // Avatar display state — listening wins (it means the mic is open right now).
  const displayState: AvatarState = micListening ? "listening" : avatarState;

  const pokeAvatar = () => {
    setPoked(true);
    if (!busy && msgs.length <= 1) send("hello 👋"); // first poke breaks the ice
  };

  const statusLine =
    displayState === "thinking"
      ? "thinking…"
      : displayState === "speaking"
        ? "speaking…"
        : displayState === "listening"
          ? "listening — go ahead…"
          : banglaActive
            ? "বাংলা মোড · প্রোডাকশন-ফার্স্ট"
            : identity.tagline;

  const showRail = !isEmpty && userTurns >= 2;

  return (
    <main className="flex h-dvh flex-col">
      <Starfield mood={mood} />

      {/* Compact persistent header — identity yields to conversation */}
      <header
        className="z-10 flex h-[56px] shrink-0 items-center gap-3 px-4 backdrop-blur-md sm:px-6"
        style={{
          background: "color-mix(in srgb, var(--bg) 60%, transparent)",
          borderBottom: "1px solid var(--line)",
        }}
      >
        {/* New conversation — appears once the chat is no longer pristine */}
        <AnimatePresence>
          {!isEmpty && (
            <motion.button
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.2 }}
              onClick={reset}
              aria-label="Start a new conversation"
              title="New conversation"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[15px] transition"
              style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--muted)" }}
            >
              <span aria-hidden>✎</span>
            </motion.button>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar state={displayState} size={38} showStatus={false} />
          <div className="min-w-0">
            <h1 className="truncate font-display text-[14px] font-semibold leading-tight" style={{ color: "var(--text)" }}>
              Zunaid Hasan <span style={{ color: "var(--accent)" }}>· AI Twin</span>
            </h1>
            <p className="flex items-center gap-1.5 truncate text-[11px]" style={{ color: "var(--muted)" }}>
              <span aria-hidden className="status-dot" data-state={displayState} />
              {statusLine}
            </p>
          </div>
        </div>

        <a
          href={identity.portfolio}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Portfolio"
          className="btn-ghost flex h-9 w-9 items-center justify-center !p-0 text-[15px] sm:h-auto sm:w-auto sm:!px-3 sm:!py-1.5 sm:text-[12px]"
        >
          <span aria-hidden>🌐</span>
          <span className="hidden sm:inline">Portfolio</span>
        </a>
        <a
          href={identity.github}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          className="btn-ghost flex h-9 w-9 items-center justify-center !p-0 text-[15px] sm:h-auto sm:w-auto sm:!px-3 sm:!py-1.5 sm:text-[12px]"
        >
          <span aria-hidden>⌥</span>
          <span className="hidden sm:inline">GitHub</span>
        </a>
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label="Open settings"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[15px] transition"
          style={{ background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--muted)" }}
        >
          <span aria-hidden>⚙</span>
        </button>
      </header>

      {/* Body: conversation column + optional desktop rail */}
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 gap-6 px-0 sm:px-4">
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Hero — centered identity anchor; yields on first message */}
          <AnimatePresence>
            {isEmpty && (
              <motion.section
                key="hero"
                aria-label="Introduction"
                className="z-10 flex flex-col items-center gap-3 px-4 pb-1 pt-7 text-center sm:pt-10"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16, height: 0, paddingTop: 0, paddingBottom: 0, transition: { duration: 0.38, ease: "easeInOut" } }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              >
                <Avatar state={displayState} size={188} showStatus={false} interactive onPoke={pokeAvatar} />
                <h2 className="font-display text-[26px] font-semibold leading-tight" style={{ color: "var(--text)" }}>
                  {identity.name}
                </h2>
                <p className="max-w-md text-[13.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>
                  {identity.tagline} — {identity.location} 🇧🇩
                </p>
                <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5">
                  {stats.slice(0, 4).map((s) => (
                    <span key={s.label} className="stat-pill">
                      <strong>{s.value}</strong> {s.label}
                    </span>
                  ))}
                </div>
                {poked && (
                  <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--muted)" }} aria-hidden>
                    let&apos;s talk 👇
                  </p>
                )}
              </motion.section>
            )}
          </AnimatePresence>

          {/* Message stream — the dominant surface once active */}
          <div
            id="chat-log"
            ref={logRef}
            role="log"
            aria-live="polite"
            aria-label="Conversation with Zunaid's AI Twin"
            className={`flex-1 overflow-y-auto px-3 sm:px-2 ${isEmpty ? "py-3" : "py-5"}`}
          >
            <div className="mx-auto flex max-w-[760px] flex-col gap-4">
              {msgs.map((m) => {
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

              {/* Soft availability CTA — once, after meaningful depth */}
              <AnimatePresence>
                {userTurns === 3 && !busy && (
                  <AvailabilityCTA onContact={() => send("contact")} onLeaveMessage={() => send("leave a message")} />
                )}
              </AnimatePresence>

              <AnimatePresence>
                {busy && avatarState === "thinking" && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 px-1 text-[12px]"
                    style={{ color: "var(--muted)" }}
                  >
                    <span className="h-2 w-2 animate-pulse rounded-full" style={{ background: "var(--accent)" }} />
                    the twin is thinking…
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Prompts + input */}
          <div
            className="z-10 shrink-0 backdrop-blur-md"
            style={{
              background: "color-mix(in srgb, var(--bg) 60%, transparent)",
              borderTop: isEmpty ? "none" : "1px solid var(--line)",
            }}
          >
            <SuggestedChips onPick={send} visible={isEmpty} />
            <MessageInput
              onSend={send}
              disabled={busy}
              banglaActive={banglaActive}
              handsFree={settings.handsFree}
              micHandleRef={micHandleRef}
              onMicStart={stopSpeaking}
              onListeningChange={setMicListening}
              streaming={avatarState !== "idle"}
              showTip={isEmpty}
            />
          </div>
        </div>

        {/* Related-content rail — large desktop only */}
        <SideRail projectIds={railProjects} visible={showRail} />
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
