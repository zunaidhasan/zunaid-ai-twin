import { NextResponse } from "next/server";

/**
 * POST /api/analytics — optional private analytics sink.
 * Set NEXT_PUBLIC_ANALYTICS_URL=/api/analytics to collect events here.
 *
 * ⚙️ PLUG-IN POINT: this default impl just logs. For a real dashboard:
 *   - Supabase: insert into twin_events (type, props, ts)
 *   - Vercel:   @vercel/kv — ZSET 'top-questions', HINCRBY 'project-opens'
 *   - Or proxy to PostHog / GA4 Measurement Protocol.
 */

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const ev = (await req.json()) as { type?: string; props?: Record<string, unknown>; ts?: number };
    if (!ev?.type) return NextResponse.json({ ok: false }, { status: 400 });
    console.log("[twin-analytics]", JSON.stringify({ ...ev, at: new Date().toISOString() }));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
