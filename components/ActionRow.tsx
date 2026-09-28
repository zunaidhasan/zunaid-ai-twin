"use client";

import type { Action } from "@/lib/engine";

/** Contextual action buttons rendered after answers. */
export default function ActionRow({ actions }: { actions: Action[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {actions.map((a) => (
        <a
          key={a.label}
          href={a.url}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost text-[13px]"
        >
          {a.icon} {a.label}
        </a>
      ))}
    </div>
  );
}
