"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring, useAnimationControls } from "framer-motion";
import { avatarUrl } from "@/lib/knowledge";

/**
 * The living avatar — now fully interactive:
 *  - idle:      soft glow pulse + gentle float
 *  - thinking:  conic aura spins + 3 dots orbit the photo
 *  - speaking:  equalizer bars (lip-sync feel) + energetic glow
 *  - listening: concentric ripples + emerald ring while the mic is open
 *  - interactive (hero): 3D tilt toward the cursor + poke-me bounce
 *
 * ⚙️ PLUG-IN POINT (real lip-sync): drive `speaking` from audio analyser
 * amplitude (AnalyserNode.getByteFrequencyData) or a viseme stream from
 * ElevenLabs/Retell for true mouth movement — swap the static bars below
 * for a 2-frame mouth swap on the photo or a 3D-ready avatar later.
 */

export type AvatarState = "idle" | "thinking" | "speaking" | "listening";

export default function Avatar({
  state = "idle",
  size = 132,
  showStatus = true,
  interactive = false,
  onPoke,
}: {
  state?: AvatarState;
  size?: number;
  showStatus?: boolean;
  interactive?: boolean;
  onPoke?: () => void;
}) {
  const speaking = state === "speaking";
  const listening = state === "listening";
  const thinking = state === "thinking";
  const wrapRef = useRef<HTMLDivElement>(null);

  // 3D tilt toward the cursor (springs make it feel physical).
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 180, damping: 18 });
  const sry = useSpring(ry, { stiffness: 180, damping: 18 });

  // Poke-me bounce.
  const controls = useAnimationControls();
  const poke = () => {
    void controls.start({
      scale: [1, 0.88, 1.12, 0.97, 1.04, 1],
      rotate: [0, -7, 6, -3, 2, 0],
      transition: { duration: 0.85, ease: "easeInOut" },
    });
    onPoke?.();
  };

  const onMove = (e: React.MouseEvent) => {
    if (!interactive || !wrapRef.current) return;
    const r = wrapRef.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * 22); // yaw
    rx.set(-py * 18); // pitch
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
  };

  const glowOpacity = speaking ? [0.55, 0.9, 0.55] : listening ? [0.5, 0.8, 0.5] : [0.4, 0.65, 0.4];

  return (
    <motion.div
      ref={wrapRef}
      className="relative flex items-center justify-center"
      style={{ width: size, height: size, perspective: 700 }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={interactive ? poke : undefined}
      role={interactive ? "button" : undefined}
      aria-label={interactive ? "Poke the avatar" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                poke();
              }
            }
          : undefined
      }
    >
      {/* Voice-reactive glow — scales/brightens with the twin's speech level
          (--twin-level is set on <html> while speaking; see page.tsx) */}
      <div aria-hidden className="voice-glow absolute inset-0 rounded-full">
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{
            background:
              "conic-gradient(from 180deg, var(--accent), var(--accent-2), var(--accent-3), var(--accent))",
            filter: "blur(16px)",
            opacity: 0.55,
          }}
          animate={
            thinking
              ? { rotate: 360, scale: [1, 1.08, 1], opacity: glowOpacity }
              : { scale: [1, 1.07, 1], opacity: glowOpacity }
          }
          transition={
            thinking
              ? { rotate: { duration: 2.6, repeat: Infinity, ease: "linear" }, scale: { duration: 1.4, repeat: Infinity }, opacity: { duration: 1.6, repeat: Infinity } }
              : { duration: speaking ? 1.6 : 3.2, repeat: Infinity, ease: "easeInOut" }
          }
        />
      </div>

      {/* Listening ripples — emanate while the mic is open */}
      {listening && (
        <>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              aria-hidden
              className="absolute rounded-full"
              style={{ border: "2px solid var(--accent)", inset: 0 }}
              animate={{ scale: [1, 1.45], opacity: [0.6, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.5, ease: "easeOut" }}
            />
          ))}
        </>
      )}

      {/* Thinking orbit — three dots revolving around the photo */}
      {thinking && (
        <motion.div
          aria-hidden
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
        >
          {[0, 120, 240].map((deg) => (
            <span
              key={deg}
              className="absolute left-1/2 top-1/2 h-[7px] w-[7px] rounded-full"
              style={{
                background: "var(--accent-3)",
                boxShadow: "0 0 8px var(--accent-3)",
                transform: `rotate(${deg}deg) translateX(${size / 2 - 4}px)`,
              }}
            />
          ))}
        </motion.div>
      )}

      {/* The photo */}
      <motion.img
        src={avatarUrl}
        alt="Zunaid Hasan — AI Twin avatar"
        width={size}
        height={size}
        className="relative rounded-full border-2 object-cover"
        style={{
          borderColor: "var(--accent)",
          width: size - 18,
          height: size - 18,
          // Photo halo breathes with the twin's voice amplitude.
          boxShadow: "0 0 calc(22px + 40px * var(--twin-level, 0)) color-mix(in srgb, var(--accent) 45%, transparent)",
          rotateX: srx,
          rotateY: sry,
          transformStyle: "preserve-3d",
          cursor: interactive ? "pointer" : undefined,
        }}
        animate={interactive ? { scale: 1 } : { scale: [1, 1.015, 1], y: [0, -3, 0] }}
        transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Lip-sync bars while speaking — driven by the real speech envelope
          (--twin-level), with a gentle CSS sway so they never look frozen. */}
      {speaking && (
        <div aria-hidden className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-end gap-[3px]">
          {[9, 15, 21, 15, 9].map((max, i) => (
            <span
              key={i}
              className="voice-bar w-[3px] rounded-full"
              style={{
                background: "var(--accent)",
                height: `calc(4px + var(--twin-level, 0) * ${max}px)`,
                animationDelay: `${i * 0.09}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Status dot */}
      {showStatus && (
        <span
          aria-label={state}
          role="status"
          className="absolute right-1 top-1 flex h-4 w-4"
        >
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{
              background: thinking ? "var(--accent-2)" : listening ? "var(--accent-3)" : "#34d399",
            }}
          />
          <span
            className="relative inline-flex h-4 w-4 rounded-full border-2"
            style={{
              background: thinking ? "var(--accent-2)" : listening ? "var(--accent-3)" : "#34d399",
              borderColor: "var(--bg)",
            }}
          />
        </span>
      )}
    </motion.div>
  );
}
