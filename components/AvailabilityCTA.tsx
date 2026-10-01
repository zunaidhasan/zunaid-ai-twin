"use client";

import { motion } from "framer-motion";
import { identity } from "@/lib/knowledge";

/**
 * Soft availability CTA — appears in-stream after meaningful interaction
 * (3+ user turns, once). Quiet card, one primary action, no pressure.
 */
export default function AvailabilityCTA({ onContact, onLeaveMessage }: { onContact: () => void; onLeaveMessage: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="mx-auto w-full max-w-md rounded-2xl px-5 py-4 text-center"
      style={{
        background: "color-mix(in srgb, var(--accent) 7%, var(--surface))",
        border: "1px solid color-mix(in srgb, var(--accent) 30%, var(--line))",
      }}
    >
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--accent-2)" }}>
        Available for new work
      </p>
      <p className="mt-1.5 text-[13.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>
        Zunaid is open to AI engineering and voice-agent builds. Want the real human? He replies fast.
      </p>
      <div className="mt-3 flex items-center justify-center gap-2">
        <button onClick={onContact} className="btn-accent text-[12.5px]">Contact card</button>
        <button onClick={onLeaveMessage} className="btn-ghost text-[12.5px]">Leave a message</button>
        <a
          href={`mailto:${identity.email}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12.5px] font-medium underline-offset-2 transition hover:underline"
          style={{ color: "var(--muted)" }}
        >
          Email directly
        </a>
      </div>
    </motion.div>
  );
}
