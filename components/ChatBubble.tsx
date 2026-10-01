"use client";

import { memo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { avatarUrl } from "@/lib/knowledge";
import { mdLite } from "@/lib/markdown";
import type { TwinPayload } from "@/lib/engine";
import ProjectCard from "./ProjectCard";
import ActionRow from "./ActionRow";
import StatsGrid from "./StatsGrid";
import MatrixRain from "./MatrixRain";
import SharePanel from "./SharePanel";
import ContactPanel from "./ContactPanel";
import LeaveMessageForm from "./LeaveMessageForm";

/**
 * One chat bubble. Twin bubbles stream in character-by-character (parent
 * controls `streamText`); user bubbles pop in. Twin bubbles can carry a rich
 * payload (project card / actions / stats / matrix…) revealed progressively.
 */

export type BubbleMsg = {
  id: string;
  role: "user" | "twin";
  text: string;
  payload?: TwinPayload;
};

export default function ChatBubble({
  msg,
  streaming,
  onChip,
  onContact,
  onLeaveMessage,
  onShare,
}: {
  msg: BubbleMsg;
  streaming?: boolean;
  onChip: (chip: string) => void;
  onContact: () => void;
  onLeaveMessage: () => void;
  /** Generates and returns the shareable URL for this conversation. */
  onShare: () => string;
}) {
  const isUser = msg.role === "user";
  const reduceMotion = useReducedMotion();

  const renderPayload = () => {
    if (!msg.payload || streaming) return null;
    const p = msg.payload;
    switch (p.kind) {
      case "project":
        return <ProjectCard projectId={p.projectId} />;
      case "actions":
        return <ActionRow actions={p.actions} />;
      case "stats":
        return <StatsGrid />;
      case "chips":
        return (
          <div className="mt-3 flex flex-wrap gap-2">
            {p.items.map((c) => (
              <button key={c} onClick={() => onChip(c)} className="chip !bg-[var(--surface)]">
                {c}
              </button>
            ))}
          </div>
        );
      case "matrix":
        return <MatrixRain />;
      case "share":
        return <SharePanel onShare={onShare} />;
      case "contact":
        return <ContactPanel />;
      case "leave-message":
        return <LeaveMessageForm />;
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 30 }}
      className={`flex w-full gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}
    >
      {!isUser && (
        <img
          src={avatarUrl}
          alt=""
          className="mt-1 h-8 w-8 shrink-0 rounded-full object-cover"
          style={{ border: "1px solid color-mix(in srgb, var(--accent) 45%, var(--line))" }}
        />
      )}
      <div className={`min-w-0 max-w-[88%] sm:max-w-[78%] ${isUser ? "items-end" : ""}`}>
        <div
          className={`rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${isUser ? "rounded-tr-md" : "rounded-tl-md"}`}
          style={{
            background: isUser ? "var(--bubble-user)" : "var(--surface)",
            border: "1px solid var(--line)",
            boxShadow: isUser ? "none" : "var(--shadow-soft)",
          }}
        >
          {streaming && !msg.text ? (
            <span className="flex items-center gap-1 py-1" aria-label="Thinking">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-2 w-2 rounded-full"
                  style={{ background: "var(--accent)" }}
                  animate={reduceMotion ? { opacity: 0.7 } : { opacity: [0.2, 1, 0.2] }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 1, repeat: Infinity, delay: i * 0.18 }}
                />
              ))}
            </span>
          ) : (
            <span
              className={streaming ? "stream-caret" : undefined}
              dangerouslySetInnerHTML={{ __html: mdLite(msg.text) }}
            />
          )}
        </div>
        <div className={`mt-1.5 ${renderPayload() ? "" : "hidden"}`}>{renderPayload()}</div>
      </div>
    </motion.div>
  );
}
