"use client";

import { motion } from "framer-motion";
import { stats, commStats } from "@/lib/knowledge";

/** Career stats grid for the "show stats" command. */
export default function StatsGrid() {
  return (
    <div className="mt-2 grid w-full grid-cols-2 gap-2 sm:grid-cols-3">
      {[...stats, ...commStats.slice(0, 2)].map((s, i) => (
        <motion.div
          key={s.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          className="rounded-xl px-3 py-2.5 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--line)" }}
        >
          <div className="text-lg font-bold" style={{ color: "var(--accent)" }}>{s.value}</div>
          <div className="text-[11px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>{s.label}</div>
        </motion.div>
      ))}
    </div>
    );
}
