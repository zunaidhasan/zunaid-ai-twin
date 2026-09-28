/**
 * Session memory — persists to localStorage so the twin remembers across
 * reloads, and exposes lightweight recall hooks so replies can reference
 * earlier questions naturally ("you asked about DeshVox earlier...").
 *
 * ⚙️ PLUG-IN POINT (analytics): every user message passes through
 * `recordMessage` — mirror that event to your analytics sink
 * (PostHog / Supabase table /GA4) by editing `analytics.record` in
 * lib/analytics.ts, which is called from here.
 */

import { recordEvent } from "./analytics";

export type Msg = {
  id: string;
  role: "user" | "twin";
  text: string;
  ts: number;
  /** Optional rich payload (project card, stats grid, etc.) */
  payload?: unknown;
  /** Language the reply was delivered in */
  lang?: "bn" | "en";
};

const HISTORY_KEY = "ztwin.history.v1";
const FACTS_KEY = "ztwin.facts.v1";
const NAME_KEY = "ztwin.name.v1";
const MAX_HISTORY = 120;

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / storage full — memory becomes session-only */
  }
}

export function loadHistory(): Msg[] {
  try {
    const raw = safeGet(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as Msg[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(msgs: Msg[]) {
  safeSet(HISTORY_KEY, JSON.stringify(msgs.slice(-MAX_HISTORY)));
}

export function clearHistory() {
  safeSet(HISTORY_KEY, "");
  safeSet(FACTS_KEY, "");
  try {
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(FACTS_KEY);
    localStorage.removeItem(NAME_KEY);
  } catch {
    /* noop */
  }
}

/* ------------------------------------------------------------------ */
/*  Recall: short-term topic tracking                                  */
/* ------------------------------------------------------------------ */

/** Extracts likely topic words from a question (very lightweight, no NLP). */
const STOP = new Set(
  ("the a an is are was were do does did what who when where why how can could would " +
    "tell about me my your his her you i we they it and or but if of to in on at for " +
    "with from as by so no yes okay ok hey hi hello please thanks thank show give " +
    "know want need like get got make made build built work works working project projects")
    .split(" ")
);

export function extractTopics(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .slice(0, 8);
}

export type Recall = {
  /** Topics the user asked about before (most recent first) */
  previousTopics: string[];
  /** Count of prior questions this session */
  turns: number;
  /** The last question the user asked */
  lastQuestion?: string;
  /** The last project discussed, if any */
  lastProjectId?: string;
  /** Names/identity facts the user shared, e.g. "my name is Rakib" */
  userName?: string;
};

export function buildRecall(history: Msg[]): Recall {
  const userMsgs = history.filter((m) => m.role === "user");
  const previousTopics: string[] = [];
  for (const m of userMsgs.slice(-6)) {
    for (const t of extractTopics(m.text)) {
      if (!previousTopics.includes(t)) previousTopics.push(t);
    }
  }
  return {
    previousTopics,
    turns: userMsgs.length,
    lastQuestion: userMsgs.at(-1)?.text,
    lastProjectId: undefined, // engine sets this via rememberLastProject
    userName: safeGet(NAME_KEY) || undefined,
  };
}

/** Picks a natural reference to earlier conversation, or "" if nothing notable. */
export function recallPhrase(recall: Recall): string {
  if (recall.turns >= 3 && recall.previousTopics.length > 0) {
    const t = recall.previousTopics[recall.previousTopics.length - 1];
    const templates = [
      `Still thinking about ${t}, I see. Good — that's where the interesting stuff is. `,
      `Back to ${t} again? You're persistent. I respect that. `,
      `Ah, you're circling back to ${t}. Let's go deeper this time. `,
    ];
    return templates[recall.turns % templates.length];
  }
  if (recall.userName) {
    const templates = [
      `${recall.userName}, here's what I know: `,
      `Alright ${recall.userName} — `,
    ];
    return templates[recall.turns % templates.length];
  }
  return "";
}

/* ------------------------------------------------------------------ */
/*  Facts the user volunteers ("my name is X")                         */
/* ------------------------------------------------------------------ */

export function rememberName(text: string): string | null {
  const m = text.match(/\b(?:my name is|i am|i'm|this is)\s+([A-Za-z\u0980-\u09FF][\w\s]{1,30})/i);
  if (!m) return null;
  const name = m[1].trim().split(/\s+/).slice(0, 2).join(" ");
  if (!name || name.length > 24) return null;
  safeSet(NAME_KEY, name);
  return name;
}

export function getName(): string | null {
  return safeGet(NAME_KEY);
}

/* ------------------------------------------------------------------ */
/*  Cross-call state used by the engine                                */
/* ------------------------------------------------------------------ */

let lastProject: string | undefined;
export function rememberLastProject(id?: string) {
  lastProject = id;
}
export function getLastProject(): string | undefined {
  return lastProject;
}

/** Record a message for recall + analytics hooks. */
export function recordMessage(msg: Msg) {
  if (msg.role === "user") {
    const name = rememberName(msg.text);
    recordEvent("question", { lang: msg.lang, named: Boolean(name), topics: extractTopics(msg.text).join(",") });
  }
}
