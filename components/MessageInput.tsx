"use client";

import { useEffect, useRef, useState } from "react";
import { listenOnce, speechRecognitionSupported } from "@/lib/voice";
import { bn } from "@/lib/lang";
import MicLevel from "@/components/MicLevel";

/** Raw SpeechRecognition error codes → human, actionable copy. */
function friendlyMicError(err: string): string {
  switch (err) {
    case "": // deliberate stop — stay silent
    case "aborted":
      return "";
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone permission denied — allow mic access in your browser settings and try again.";
    case "no-speech":
      return "Didn't catch that — tap the mic and speak a little louder.";
    case "audio-capture":
      return "No microphone found. Check that a mic is connected.";
    case "network":
      return "Speech service unreachable — check your internet connection.";
    case "unsupported":
      return "Voice input needs Chrome or Edge — type your message instead.";
    case "start-failed":
      return "Couldn't start the microphone — close other apps using it and retry.";
    default:
      return `Mic error: ${err}`;
  }
}

/**
 * Message input: auto-growing textarea + mic (web SpeechRecognition) + send.
 * Mic language follows the current Bangla/English mode for better accuracy.
 *
 * Voice flow: the transcript fills the box while you talk, and when you stop,
 * it AUTO-SENDS — no extra button press needed. In hands-free mode the twin's
 * reply is spoken aloud and the mic reopens automatically (see page.tsx).
 */
export default function MessageInput({
  onSend,
  disabled,
  banglaActive,
  handsFree,
  onMicStart,
  micHandleRef,
  onListeningChange,
  streaming,
  showTip,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  banglaActive: boolean;
  handsFree?: boolean;
  onMicStart?: () => void;
  micHandleRef?: React.MutableRefObject<(() => void) | null>;
  onListeningChange?: (listening: boolean) => void;
  /** True while the twin's reply is streaming → sound-wave border on the bar. */
  streaming?: boolean;
  /** Voice tip is rendered only in the empty (pre-conversation) state. */
  showTip?: boolean;
}) {
  const [value, setValue] = useState("");
  const [listening, setListening] = useState(false);
  const [micNote, setMicNote] = useState<string | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const lastTranscriptRef = useRef("");
  // Latest state for use inside the dictation callbacks without re-binding.
  const stateRef = useRef({ disabled: !!disabled, handsFree: !!handsFree });
  stateRef.current = { disabled: !!disabled, handsFree: !!handsFree };

  const setListeningState = (on: boolean) => {
    setListening(on);
    onListeningChange?.(on);
  };

  // Auto-grow up to ~5 lines.
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [value]);

  const submit = () => {
    const v = value.trim();
    if (!v || disabled) return;
    onSend(v);
    setValue("");
  };

  const startListening = () => {
    setMicNote(null);
    setListeningState(true);
    onMicStart?.(); // stop any speaking reply so the mic isn't fighting the TTS
    lastTranscriptRef.current = "";
    cancelRef.current = listenOnce(
      banglaActive ? "bn" : "en",
      (t) => {
        lastTranscriptRef.current = t;
        setValue(t);
      },
      () => {
        // Speech ended → AUTO-SEND what was heard. This is the fix for
        // "listening but not responding": no extra Send press needed.
        setListeningState(false);
        const final = lastTranscriptRef.current.trim();
        if (!final) return;
        const { disabled: isDisabled, handsFree: hf } = stateRef.current;
        if (isDisabled) return; // twin is mid-reply — leave text in the box to send manually
        if (hf) setValue(""); // hands-free: box stays clean, purely conversational
        onSend(final);
      },
      (err) => {
        setListeningState(false);
        const msg = friendlyMicError(err);
        if (msg) {
          setMicNote(msg);
          setTimeout(() => setMicNote(null), 4500);
        }
      }
    );
  };

  // Expose the mic starter for hands-free mode — page.tsx reopens the mic
  // after each spoken reply without remounting this component.
  useEffect(() => {
    if (micHandleRef) micHandleRef.current = startListening;
  });

  const toggleMic = () => {
    if (listening) {
      cancelRef.current?.();
      return;
    }
    startListening();
  };

  return (
    <div className="px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pb-5">
      {micNote && (
        <p className="mb-1.5 px-1 text-[12px]" style={{ color: "#f87171" }} role="alert">{micNote}</p>
      )}
      <div
        className={`mx-auto flex max-w-3xl items-end gap-2 rounded-2xl p-2 transition-shadow ${listening ? "ring-1 ring-[var(--accent)]" : ""} ${streaming ? "wave-live" : ""}`}
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          boxShadow: listening
            ? "0 0 0 1px color-mix(in srgb, var(--accent) 35%, transparent), 0 8px 30px color-mix(in srgb, var(--accent) 18%, transparent)"
            : "var(--shadow-soft)",
        }}
      >
        {/* Mic */}
        <button
          onClick={toggleMic}
          disabled={disabled}
          aria-label={listening ? "Stop listening" : bn.speak}
          className={`mic-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg transition ${listening ? "mic-live" : ""}`}
          style={{
            background: listening ? "var(--accent)" : "var(--surface-2)",
            color: listening ? "#fff" : "var(--muted)",
            border: "1px solid var(--line)",
          }}
        >
          {listening ? "⏹" : "🎙️"}
        </button>

        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          placeholder={listening ? bn.listening : bn.placeholder}
          aria-label="Message the AI twin"
          className="max-h-[120px] min-h-[40px] flex-1 resize-none bg-transparent px-1 py-2 text-[15px] outline-none"
          style={{ color: "var(--text)" }}
        />

        {/* Live mic level (only while listening) */}
        {listening && <MicLevel active />}

        <button
          onClick={submit}
          disabled={disabled || !value.trim()}
          aria-label={bn.send}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg transition disabled:opacity-40"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          ➤
        </button>
      </div>
      {showTip && (
        <p className="mx-auto mt-1.5 hidden max-w-3xl text-center text-[11px] sm:block" style={{ color: "var(--muted)" }}>
          {speechRecognitionSupported()
            ? "Press the mic and just talk — it sends itself when you stop."
            : "Voice input needs Chrome or Edge."} Try <code>matrix</code> · <code>show stats</code> · <code>roast my idea</code>
        </p>
      )}
    </div>
  );
}
