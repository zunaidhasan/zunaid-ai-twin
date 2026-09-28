"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { projects } from "@/lib/knowledge";
import { recordEvent } from "@/lib/analytics";

/**
 * Rich project card — expands beautifully when a project is discussed.
 * Fires 'project_open' analytics so "popular projects" dashboards work later.
 */
export default function ProjectCard({ projectId }: { projectId: string }) {
  const p = projects.find((x) => x.id === projectId);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (p) recordEvent("project_open", { id: p.id });
  }, [p]);

  if (!p) return null;

  const statusColor: Record<string, string> = {
    Active: "#34d399",
    Live: "#34d399",
    Deployed: "#60a5fa",
    Internal: "#fbbf24",
    Complete: "#a78bfa",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="mt-2 w-full overflow-hidden rounded-2xl"
      style={{ background: "var(--surface)", border: "1px solid var(--line)", boxShadow: "var(--shadow-soft)" }}
    >
      {/* Header — click to collapse/expand */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
        aria-expanded={open}
      >
        <span aria-hidden className="text-2xl">{p.emoji}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold" style={{ color: "var(--text)" }}>{p.name}</span>
          <span className="block truncate text-[13px]" style={{ color: "var(--muted)" }}>{p.tagline}</span>
        </span>
        <span
          className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{ background: `color-mix(in srgb, ${statusColor[p.status]} 18%, transparent)`, color: statusColor[p.status] }}
        >
          {p.status}
        </span>
        <motion.span animate={{ rotate: open ? 180 : 0 }} className="text-xs" style={{ color: "var(--muted)" }}>▼</motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: "easeInOut" }}
          >
            <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "var(--line)" }}>
              <p className="text-[13.5px] leading-relaxed" style={{ color: "var(--text-2)" }}>{p.description}</p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.stack.map((s) => (
                  <span
                    key={s}
                    className="rounded-md px-2 py-0.5 text-[11px]"
                    style={{ background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--line)" }}
                  >
                    {s}
                  </span>
                ))}
              </div>

              {p.impact && (
                <p className="mt-3 rounded-lg px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
                  💡 {p.impact}
                </p>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                {p.demo && (
                  <a href={p.demo} target="_blank" rel="noopener noreferrer" className="btn-accent text-[13px]">
                    🚀 Live Demo
                  </a>
                )}
                {p.github && (
                  <a href={p.github} target="_blank" rel="noopener noreferrer" className="btn-ghost text-[13px]">
                    ⭐ GitHub
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
