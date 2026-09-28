"use client";

import { identity } from "@/lib/knowledge";

/** Contact card payload for the "contact" command. */
export default function ContactPanel() {
  const rows = [
    { icon: "✉️", label: "Email", value: identity.email, href: `mailto:${identity.email}` },
    { icon: "💼", label: "LinkedIn", value: "in/zunaid-ishan", href: identity.linkedin },
    { icon: "🐙", label: "GitHub", value: "zunaidhasan", href: identity.github },
    { icon: "📞", label: "Phone", value: identity.phone, href: `tel:${identity.phone.replace(/[^\d+]/g, "")}` },
  ];
  return (
    <div className="mt-2 grid w-full gap-1.5 rounded-xl p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
      {rows.map((r) => (
        <a
          key={r.label}
          href={r.href}
          target={r.href.startsWith("mailto") || r.href.startsWith("tel") ? undefined : "_blank"}
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-[13px] transition hover:-translate-y-px"
          style={{ color: "var(--text-2)" }}
        >
          <span aria-hidden>{r.icon}</span>
          <span style={{ color: "var(--muted)" }}>{r.label}</span>
          <span className="ml-auto font-medium">{r.value}</span>
        </a>
      ))}
      <a href={identity.bookCall} target="_blank" rel="noopener noreferrer" className="btn-accent mt-1 justify-center text-[13px]">
        📅 Book a Call
      </a>
    </div>
  );
}
