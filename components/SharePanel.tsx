"use client";

import { useState } from "react";
import { recordEvent } from "@/lib/analytics";

/**
 * Share panel — generates a unique shareable URL for the conversation.
 * The heavy lifting (deflate → URL hash) lives in lib/share.ts.
 */
export default function SharePanel({ onShare }: { onShare: () => string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = () => {
    try {
      const u = onShare();
      setUrl(u);
      recordEvent("share_created");
    } catch {
      setError("This conversation got too epic to encode 😅 — try sharing after a refresh.");
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed — select the link manually.");
    }
  };

  if (!url) {
    return (
      <button onClick={generate} className="btn-accent mt-2 text-[13px]">
        🔗 Generate share link
      </button>
    );
  }

  return (
    <div className="mt-2 w-full rounded-xl p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
      <p className="text-[12px]" style={{ color: "var(--muted)" }}>
        Our conversation, compressed into a link — no server, no database, just math:
      </p>
      <div className="mt-2 flex items-center gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg px-2.5 py-1.5 font-mono text-[11px] outline-none"
          style={{ background: "var(--bg)", color: "var(--text-2)", border: "1px solid var(--line)" }}
          aria-label="Shareable conversation link"
        />
        <button onClick={copy} className="btn-accent shrink-0 text-[12px]">
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-[12px]" style={{ color: "#f87171" }}>{error}</p>}
    </div>
  );
}
