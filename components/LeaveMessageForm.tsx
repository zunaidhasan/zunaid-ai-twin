"use client";

import { useState } from "react";
import { recordEvent } from "@/lib/analytics";

/**
 * "Leave a message for Zunaid" — POSTs to /api/message.
 * ⚙️ PLUG-IN POINT (delivery): /api/message currently logs server-side.
 * Wire it to Resend / Supabase / an email webhook (see file comments) — or
 * paste a NEXT_PUBLIC_FORM_ENDPOINT (Formspree-style) to skip the API route.
 */
export default function LeaveMessageForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [note, setNote] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || state === "sending") return;
    setState("sending");
    recordEvent("message_left");

    try {
      const res = await fetch("/api/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, body }),
      });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { ok: boolean; stored?: boolean };
      setState("sent");
      setNote(data.stored ? null : "Delivered to the twin's outbox.");
    } catch {
      setState("error");
      setNote("Couldn't send — email connect.zunaid@gmail.com directly and it lands the same place.");
    }
  };

  if (state === "sent") {
    return (
      <div className="mt-2 rounded-xl p-4 text-center" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
        <p className="text-2xl" aria-hidden>📨</p>
        <p className="mt-1 text-[14px] font-medium" style={{ color: "var(--text)" }}>Message sent!</p>
        <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--muted)" }}>
          {note || "It's in Zunaid's inbox — expect a reply within 24h."}
        </p>
      </div>
    );
  }

  const inputCls = "w-full rounded-lg px-3 py-2 text-[13.5px] outline-none transition focus:border-[var(--accent)]";
  const inputStyle = { background: "var(--bg)", border: "1px solid var(--line)", color: "var(--text)" };

  return (
    <form onSubmit={submit} className="mt-2 w-full rounded-xl p-3" style={{ background: "var(--surface-2)", border: "1px solid var(--line)" }}>
      <p className="mb-2 text-[13px] font-medium" style={{ color: "var(--text)" }}>
        📝 Leave a message for the human
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" className={inputCls} style={inputStyle} maxLength={60} aria-label="Your name" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Your email (optional)" className={inputCls} style={inputStyle} maxLength={80} aria-label="Your email" />
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Hi Zunaid — I saw the AI twin and…"
        rows={3}
        maxLength={600}
        className={`${inputCls} mt-2 resize-none`}
        style={inputStyle}
        aria-label="Your message"
        required
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px]" style={{ color: "var(--muted)" }}>{body.length}/600</span>
        <button type="submit" disabled={state === "sending" || !body.trim()} className="btn-accent text-[13px] disabled:opacity-50">
          {state === "sending" ? "Sending…" : "Send it 🚀"}
        </button>
      </div>
      {state === "error" && <p className="mt-1.5 text-[12px]" style={{ color: "#f87171" }}>{note}</p>}
    </form>
  );
}
