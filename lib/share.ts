/**
 * Shareable conversations.
 *
 * The whole conversation is deflate-compressed into the URL hash — no
 * database needed, links work forever, and nothing leaves the browser.
 * Format:  /s/#z=<base64url(deflate(json))>
 *
 * ⚙️ PLUG-IN POINT (short links): if fat URLs bother you, POST the payload
 * to /api/message or a Supabase table and store only an id in the hash.
 * The viewer in app/s/page.tsx already decodes from the hash, so a server
 * render can hydrate the same way.
 */

import { deflate, inflate } from "pako";

export type ShareMsg = { role: "user" | "twin"; text: string };

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function encodeConversation(msgs: ShareMsg[]): string {
  const json = JSON.stringify({ v: 1, m: msgs });
  return toBase64Url(deflate(json));
}

export function decodeConversation(hash: string): ShareMsg[] | null {
  try {
    const m = hash.match(/z=([A-Za-z0-9_-]+)/);
    if (!m) return null;
    const json = inflate(fromBase64Url(m[1]), { to: "string" });
    const parsed = JSON.parse(json) as { v: number; m: ShareMsg[] };
    if (!Array.isArray(parsed.m)) return null;
    return parsed.m
      .filter((x) => x && typeof x.text === "string" && (x.role === "user" || x.role === "twin"))
      .slice(0, 200);
  } catch {
    return null;
  }
}

export function buildShareUrl(msgs: ShareMsg[]): string {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/s/#z=${encodeConversation(msgs)}`;
}

/** Rough shareable-size guard: browsers cap URLs ~32k–64k chars. */
export function shareSizeOk(msgs: ShareMsg[]): boolean {
  return buildShareUrl(msgs).length < 30000;
}

/** Trims a conversation from the middle until the share URL fits. */
export function trimToShareable(msgs: ShareMsg[]): ShareMsg[] {
  if (shareSizeOk(msgs)) return msgs;
  let out = [...msgs];
  while (out.length > 4 && !shareSizeOk(out)) {
    out.splice(Math.floor(out.length / 2) - 1, 2); // drop pairs from the middle
  }
  return out.slice(-80);
}
