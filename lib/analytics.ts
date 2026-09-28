/**
 * Private analytics hooks.
 *
 * Everything is opt-in-light: counters live in localStorage for the "show stats"
 * command, and `recordEvent` ships nothing off-device by default.
 *
 * ⚙️ PLUG-IN POINT (real analytics): set NEXT_PUBLIC_ANALYTICS_URL to an
 * endpoint (your API route, Supabase Edge Function, PostHog proxy, GA4
 * Measurement Protocol…) and events POST there as { type, props, ts }.
 * Suggested dashboard queries once wired:
 *   - most asked questions  → group by props.topics
 *   - popular projects      → type === 'project_open', group by props.id
 *   - voice usage           → type === 'voice_reply_toggled'
 */

const KEY = "ztwin.events.v1";
const REMOTE = process.env.NEXT_PUBLIC_ANALYTICS_URL;

type Stored = { counts: Record<string, number>; projects: Record<string, number> };

function read(): Stored {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "") as Stored;
  } catch {
    return { counts: {}, projects: {} };
  }
}

function write(s: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

export type EventType =
  | "question" // every user question
  | "project_open" // a project card was rendered
  | "voice_reply_toggled"
  | "command_used" // matrix / stats / roast…
  | "message_left" // leave-a-message submitted
  | "share_created";

export function recordEvent(type: EventType, props?: Record<string, string | boolean | undefined>) {
  // 1) Local counters (power "show stats")
  const s = read();
  s.counts[type] = (s.counts[type] || 0) + 1;
  if (type === "project_open" && props?.id) s.projects[String(props.id)] = (s.projects[String(props.id)] || 0) + 1;
  write(s);

  // 2) Remote sink — only if configured. Fire-and-forget, never blocks UI.
  if (REMOTE) {
    try {
      void fetch(REMOTE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, props, ts: Date.now() }),
        keepalive: true,
      });
    } catch {
      /* offline is fine */
    }
  }
}

export function localCounts(): Stored["counts"] {
  return read().counts;
}

export function popularProjects(): { id: string; opens: number }[] {
  const s = read();
  return Object.entries(s.projects)
    .map(([id, opens]) => ({ id, opens }))
    .sort((a, b) => b.opens - a.opens);
}
