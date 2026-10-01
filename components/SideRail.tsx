"use client";

import { motion } from "framer-motion";
import ProjectCard from "./ProjectCard";
import { stats, stack } from "@/lib/knowledge";

/**
 * Desktop-only related-content rail (≥1280px). Reveals progressively as the
 * conversation touches topics: discussed project first, then stack summary,
 * then core stats. Nothing decorative — every card is a jump-off point.
 */
export default function SideRail({ projectIds, visible }: { projectIds: string[]; visible: boolean }) {
  if (!visible || projectIds.length === 0) return null;

  const stackLine = stack
    .slice(0, 3)
    .map((s) => s.layer)
    .join(" · ");

  return (
    <motion.aside
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      aria-label="Related content from this conversation"
      className="sticky top-[76px] hidden w-64 shrink-0 flex-col gap-2.5 xl:flex"
    >
      <p className="px-1 text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
        From this conversation
      </p>

      {projectIds.slice(0, 2).map((id) => (
        <ProjectCard key={id} projectId={id} variant="compact" />
      ))}

      <div className="rounded-xl px-3 py-2.5" style={{ background: "var(--surface)", border: "1px solid var(--line)" }}>
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Stack</p>
        <p className="mt-1 text-[12px] leading-snug" style={{ color: "var(--text-2)" }}>{stackLine}</p>
      </div>

      <div className="flex flex-wrap gap-1.5 px-0.5">
        {stats.slice(0, 4).map((s) => (
          <span key={s.label} className="stat-pill">
            <strong>{s.value}</strong> {s.label}
          </span>
        ))}
      </div>
    </motion.aside>
  );
}
