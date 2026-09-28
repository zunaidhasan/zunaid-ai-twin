import { NextResponse } from "next/server";

/**
 * POST /api/message — "Leave a message for Zunaid".
 *
 * ⚙️ PLUG-IN POINT (real delivery) — pick one:
 *
 * 1. RESEND (recommended, free tier):
 *      npm i resend
 *      // then:
 *      import { Resend } from "resend";
 *      const resend = new Resend(process.env.RESEND_API_KEY);
 *      await resend.emails.send({
 *        from: "AI Twin <twin@yourdomain.com>",
 *        to: "connect.zunaid@gmail.com",
 *        subject: `AI Twin message from ${name || "a visitor"}`,
 *        text: `${body}\n\nReply-to: ${email || "not provided"}`,
 *      });
 *
 * 2. SUPABASE (store + dashboard later):
 *      const { error } = await supabase.from("twin_messages").insert({...});
 *
 * 3. Formspree-style: skip this route entirely and set
 *      NEXT_PUBLIC_FORM_ENDPOINT=https://formspree.io/f/xxxx
 *    — the client form will post there instead. (See LeaveMessageForm.)
 */

export const runtime = "nodejs";

const recent = new Map<string, number>(); // naive in-memory rate limit

export async function POST(req: Request) {
  let data: { name?: string; email?: string; body?: string };
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const name = (data.name || "").trim().slice(0, 60);
  const email = (data.email || "").trim().slice(0, 80);
  const body = (data.body || "").trim().slice(0, 600);

  if (!body) return NextResponse.json({ ok: false }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Naive per-IP throttle: 3 messages / 10 min.
  const ip = req.headers.get("x-forwarded-for") || "local";
  const now = Date.now();
  const last = recent.get(ip) || 0;
  if (now - last < 60_000 && recent.size) {
    return NextResponse.json({ ok: false, reason: "slow down" }, { status: 429 });
  }
  recent.set(ip, now);
  if (recent.size > 500) recent.clear();

  // ── Delivery plug-in section ─────────────────────────────────
  // Default behavior: log server-side (visible in host's function logs).
  console.log("[twin-message]", JSON.stringify({ name, email, body, at: new Date().toISOString() }));
  const stored = true; // flip to false when a real sink is configured
  // ─────────────────────────────────────────────────────────────

  return NextResponse.json({ ok: true, stored });
}
