"use client";

import { useEffect, useState } from "react";
import { decodeConversation, type ShareMsg } from "@/lib/share";
import { avatarUrl, identity } from "@/lib/knowledge";
import { mdLite } from "@/lib/markdown";
import Starfield from "@/components/Starfield";

/**
 * Share viewer — /s/#z=<payload>. Renders a read-only conversation.
 * No DB: the whole chat lives (compressed) in the link itself.
 */
export default function SharedView() {
  const [msgs, setMsgs] = useState<ShareMsg[] | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    const decoded = decodeConversation(window.location.hash);
    if (decoded && decoded.length) setMsgs(decoded);
    else setBroken(true);
  }, []);

  return (
    <main className="flex h-dvh flex-col">
      <Starfield mood={{ hue: 200 }} />
      <header className="flex items-center gap-3 px-4 py-3 backdrop-blur-md sm:px-6" style={{ borderBottom: "1px solid var(--line)", background: "color-mix(in srgb, var(--bg) 55%, transparent)" }}>
        <img src={avatarUrl} alt="" className="h-10 w-10 rounded-full border object-cover" style={{ borderColor: "var(--accent)" }} />
        <div>
          <h1 className="font-display text-[16px] font-semibold">A conversation with Zunaid's AI Twin</h1>
          <a href="/" className="text-[12px]" style={{ color: "var(--accent)" }}>Start your own conversation →</a>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-6 sm:px-5">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {broken && (
            <p className="rounded-xl p-4 text-center text-[14px]" style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--muted)" }}>
              This share link is malformed or expired. 🧐 <a href="/" style={{ color: "var(--accent)" }}>Start fresh →</a>
            </p>
          )}
          {msgs?.map((m, i) => (
            <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              {m.role === "twin" && <img src={avatarUrl} alt="" className="h-8 w-8 shrink-0 rounded-full border object-cover" style={{ borderColor: "var(--accent)" }} />}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-[14.5px] leading-relaxed ${m.role === "user" ? "rounded-tr-md" : "rounded-tl-md"}`}
                style={{
                  background: m.role === "user" ? "var(--bubble-user)" : "var(--surface)",
                  border: "1px solid var(--line)",
                  color: m.role === "user" ? "#fff" : "var(--text)",
                  boxShadow: "var(--shadow-soft)",
                }}
              >
                <span dangerouslySetInnerHTML={{ __html: mdLite(m.text) }} />
              </div>
            </div>
          ))}
          {msgs && (
            <footer className="mt-6 text-center text-[12px]" style={{ color: "var(--muted)" }}>
              Shared via <a href={identity.portfolio} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>Zunaid Hasan's AI Twin</a> — links encode conversations, servers store nothing.
            </footer>
          )}
        </div>
      </div>
    </main>
  );
}
