# AI Twin P0–P3 Fix Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make advertised AI Twin behavior match the code: real streaming, no theme flash, fonts, command routing, honest messaging, and a locked input until a reply finishes.

**Architecture:** Keep the hybrid brain (rule engine + optional `/api/chat`). Fix client wiring first (`app/page.tsx`, `ChatBubble`, layout/theme). Extract `tryCommand` from `lib/engine.ts` so special commands always win over the LLM. Defer visual redesign (SVG icons, nav) and backend sinks to later waves.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind 4, Framer Motion, Web Speech API.

## Global Constraints

- Do not add npm dependencies unless a later task explicitly requires them.
- Do not invent demo URLs, emails, or booking links; keep knowledge-base honesty.
- Keys stay server-side (`LLM_API_KEY` never `NEXT_PUBLIC_`).
- Leave-a-message must not claim inbox delivery until Resend/Supabase is wired.
- Preserve existing public command names: `matrix`, `bangla mode`, `english mode`, `show stats`, `roast`, `architecture`, `help`, `contact`, `leave a message`, `share`.
- Match existing code style: no new comments unless needed, CSS variables for theme.

## File map

| File | Role in this plan |
|------|-------------------|
| `lib/engine.ts` | Export `tryCommand`; honest leave-message copy |
| `app/page.tsx` | Command-first send path, busy-until-stream-done, `onMicStart`, payload persist |
| `components/ChatBubble.tsx` | Show streamed text + caret; dots only while empty |
| `app/layout.tsx` | Font CSS variables on `body`; theme boot from `ztwin.settings.v1` |
| `components/LeaveMessageForm.tsx` | Honest success/error copy; visible labels |
| `components/MessageInput.tsx` | Already calls `onMicStart`; page must pass it |
| `lib/memory.ts` | Clear saved name on reset (P1) |
| `lib/llm.ts` / `app/api/chat/route.ts` | Pass `userName`; rate limit (P1) |

---

## Wave 0 — P0 (this session)

Fix bugs that contradict README or break core chat. Each task is independently testable in the browser / `npm run typecheck`.

### Task 1: Stream text instead of hiding it behind dots

**Files:**
- Modify: `components/ChatBubble.tsx`

**Why:** `useStreamer` already reveals `partial` text, but ChatBubble renders three dots whenever `streaming` is true, so the typing effect never appears.

- [ ] **Step 1:** In `ChatBubble`, treat empty streaming as thinking-dots; once `msg.text` has content, render markdown-lite with `.stream-caret`.
- [ ] **Step 2:** Keep payloads hidden until `streaming` is false (current behavior).
- [ ] **Step 3:** Manual check: send `help` — text should type in with a caret, then chips appear.

**Implementation:**

```tsx
{streaming && !msg.text ? (
  <span className="flex items-center gap-1 py-1" aria-label="Thinking">
    {[0, 1, 2].map((i) => (
      <motion.span
        key={i}
        className="h-2 w-2 rounded-full"
        style={{ background: "var(--accent)" }}
        animate={{ opacity: [0.2, 1, 0.2] }}
        transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
      />
    ))}
  </span>
) : (
  <span
    className={streaming ? "stream-caret" : undefined}
    dangerouslySetInnerHTML={{ __html: mdLite(msg.text) }}
  />
)}
```

---

### Task 2: Theme boot reads the same key settings use

**Files:**
- Modify: `app/layout.tsx`

**Why:** Boot script reads `ztwin.theme`; page persists `ztwin.settings.v1`. Reload always flashes Studio Dark.

- [ ] **Step 1:** Parse `ztwin.settings.v1` JSON and apply `s.theme` before paint.
- [ ] **Step 2:** Fall back to `"studio"` on missing/invalid data.
- [ ] **Step 3:** Manual check: set Bangladesh Green, hard reload — no purple flash.

**Implementation:**

```js
const themeBoot = `(function(){try{var t="studio";var raw=localStorage.getItem("ztwin.settings.v1");if(raw){var s=JSON.parse(raw);if(s&&typeof s.theme==="string")t=s.theme;}document.documentElement.setAttribute("data-theme",t);}catch(e){}})();`;
```

---

### Task 3: Attach Next font CSS variables to `body`

**Files:**
- Modify: `app/layout.tsx`

**Why:** `Fredoka` / `Inter` set `--font-fredoka` / `--font-inter` on a class that is never applied, so `globals.css` falls back to system UI.

- [ ] **Step 1:** Add `${fredoka.variable} ${inter.variable}` to `body.className`.
- [ ] **Step 2:** Confirm headings use Fredoka and body uses Inter in DevTools.

**Implementation:**

```tsx
<body className={`${fredoka.variable} ${inter.variable} min-h-dvh antialiased`}>
```

---

### Task 4: Hold `busy` until the twin finishes streaming

**Files:**
- Modify: `app/page.tsx`

**Why:** `setBusy(false)` after 600ms while streaming/LLM can run much longer → double-sends and overlapping replies.

- [ ] **Step 1:** Remove the 600ms `setTimeout` in `send`.
- [ ] **Step 2:** Call `setBusy(false)` in the streamer `onDone` callback inside `pushTwin`.
- [ ] **Step 3:** Manual check: mash Enter — second send is ignored until the caret finishes.

---

### Task 5: Special commands always win over the LLM

**Files:**
- Modify: `lib/engine.ts` — export `tryCommand`
- Modify: `app/page.tsx` — call it before `/api/chat`

**Why:** Comments claim the rule engine still covers commands when LLM is on; `send()` currently POSTs everything to `/api/chat` first.

- [ ] **Step 1:** Export `tryCommand(raw, ctx)` that returns `runCommands(...)`.
- [ ] **Step 2:** In `send`, if `tryCommand` hits, `pushTwin` and skip the LLM.
- [ ] **Step 3:** Manual check with `NEXT_PUBLIC_LLM_MODE` set (or code path): `matrix` / `show stats` / `share` still open their payloads.

**Implementation (engine):**

```ts
export function tryCommand(raw: string, ctx: EngineContext): TwinReply | undefined {
  return runCommands(raw, ctx);
}
```

**Implementation (page send path):**

```ts
const ctx = { tone: settings.tone, history: msgs as Msg[], langLock: banglaActive ? "bn" : null };
const cmd = tryCommand(text, ctx);
if (cmd) {
  setTimeout(() => pushTwin(cmd, text), 420);
} else if (isLlmEnabled()) {
  // existing fetch + fallback generateReply
} else {
  setTimeout(() => pushTwin(generateReply(text, ctx), text), 420);
}
```

---

### Task 6: Honest leave-a-message + stop mic from fighting TTS

**Files:**
- Modify: `lib/engine.ts` (leave-message command copy)
- Modify: `components/LeaveMessageForm.tsx`
- Modify: `app/page.tsx` — pass `onMicStart={() => stopSpeaking()}`
- Modify: `app/page.tsx` — persist `payload` when saving history on user send

**Why:** UI promises 24h inbox delivery; route only logs. Mic start never stops TTS. History save drops payloads so cards vanish after reload.

- [ ] **Step 1:** Engine copy: do not say "straight to Zunaid's inbox".
- [ ] **Step 2:** Form success: "Logged on the server for now. Email delivery is not wired yet — for anything urgent, email connect.zunaid@gmail.com."
- [ ] **Step 3:** Visible `<label>` on name/email/message (not placeholder-only).
- [ ] **Step 4:** `MessageInput onMicStart={stopSpeaking}`.
- [ ] **Step 5:** `saveHistory` includes `payload`.

---

## Wave 1 — P1 (next session)

Reliability, a11y, and LLM quality. Do not start until Wave 0 is verified.

### Task 7: Streamer cleanup + pass userName into `/api/chat`

**Files:** `app/page.tsx`, `lib/memory.ts`, `app/api/chat/route.ts`

- Clear streamer intervals on unmount.
- Send `userName: getName()` in the chat POST body (API already accepts it).
- `clearHistory` also `localStorage.removeItem("ztwin.name.v1")`.

### Task 8: `/api/chat` rate limit + fail closed

**Files:** `app/api/chat/route.ts`

- In-memory per-IP throttle (same pattern as message route, but document serverless limits).
- Reject oversize bodies (already 4000 chars / 12 msgs — keep).
- Optional: check `Origin` against the deployment host.

### Task 9: Settings drawer keyboard + `lang` on `<html>`

**Files:** `components/SettingsPanel.tsx`, `app/page.tsx`, `app/layout.tsx`

- Escape closes drawer; focus the close button on open (no full focus-trap library).
- When `banglaActive`, set `document.documentElement.lang = "bn"` (else `"en"`).

### Task 10: Reduced motion on Avatar / Framer bubbles

**Files:** `components/Avatar.tsx`, `components/ChatBubble.tsx`

- If `prefers-reduced-motion: reduce`, skip orbit/float/equalizer loops; keep static photo.

### Task 11: Light-theme contrast

**Files:** `app/globals.css`

- Raise `[data-theme="light"] --muted` and `--text-2` until body/secondary text ≥ 4.5:1 on `--bg` / `--surface`.

### Task 12: Mobile header links

**Files:** `app/page.tsx`

- Show Portfolio / GitHub as icon buttons on small screens (or overflow menu). Do not leave them `hidden sm:inline-flex` with no alternative.

---

## Wave 2 — P2

Product completeness. Requires copy/URL decisions in `lib/knowledge.ts`.

### Task 13: Knowledge URL honesty

**Files:** `lib/knowledge.ts`, `components/ProjectCard.tsx`

- Remove or relabel `demo`/`github` entries that point at the profile root.
- Hide "View Live Demo" when `demo` is missing or equals `identity.github`.
- Confirm `identity.bookCall` or drop the button.

### Task 14: Share viewer richness

**Files:** `app/s/page.tsx`

- Reuse `mdLite` (extract to `lib/markdown.ts`) so shared threads render bold/code.
- Keep payloads out of the hash (size); link "Start your own" remains.

### Task 15: Extract `lib/markdown.ts` + split chat hooks

**Files:** create `lib/markdown.ts`; optionally `hooks/useStreamer.ts`

- Move `mdLite` out of ChatBubble.
- Move `useStreamer` out of `page.tsx` if the file is still growing.

### Task 16: PWA + OG

**Files:** `public/sw.js`, `app/layout.tsx`, `public/`

- Precache `/me.png`.
- Add a dedicated OG image or point Open Graph at a guaranteed local path.
- Network-first HTML so deploys are not sticky.

### Task 17: Real message sink (optional, needs secrets)

**Files:** `app/api/message/route.ts`

- Only after the owner provides `RESEND_API_KEY` (or equivalent). Then restore "inbox" copy.

---

## Wave 3 — P3

Polish. Not blocking launch of P0/P1.

### Task 18: Replace emoji chrome with SVG (Lucide)

Header, input, settings, action icons. Keep emoji inside twin *copy* if it is personality.

### Task 19: Stop / regenerate / thumbs on twin bubbles

Standard AI chat controls. Regenerating should re-run engine/LLM for the last user turn.

### Task 20: Tests + error boundary

- Add `node:test` (or Vitest) for `tryCommand`, `detectLanguage`, `trimToShareable`.
- React error boundary around the chat log.
- Drop or justify `eslint: { ignoreDuringBuilds: true }`.
- Add `npm run lint` script.

### Task 21: Onboarding + installability

- First-run tooltip: voice, themes, Bangla lock.
- Soft PWA install hint.
- Safari STT: in-input note, not only a desktop footnote.

---

## Verification (every wave)

```bash
npm run typecheck
npm run build
```

Browser smoke (Wave 0):

1. Hard reload — chosen theme, no flash; Fredoka on the title.
2. Send `help` — characters stream with caret; chips after.
3. Rapid Enter — one in-flight reply.
4. `matrix`, `show stats`, `leave a message` — payloads, honest form copy.
5. Enable voice, tap mic while speaking — TTS stops.

---

## Spec coverage

| Review item | Task |
|-------------|------|
| Fake streaming | 1 |
| Theme key mismatch | 2 |
| Fonts unused | 3 |
| Busy 600ms | 4 |
| LLM skips commands | 5 |
| Message honesty | 6 |
| Mic vs TTS | 6 |
| History drops payloads | 6 |
| Streamer leak / userName | 7 |
| Chat rate limit | 8 |
| Settings Escape / html lang | 9 |
| Reduced motion avatar | 10 |
| Light contrast | 11 |
| Mobile nav | 12 |
| Fake demo URLs | 13 |
| Share markdown | 14 |
| page.tsx god component | 15 |
| SW / OG | 16 |
| Real email | 17 |
| SVG icons | 18 |
| Stop/regenerate | 19 |
| Tests / eslint | 20 |
| Onboarding | 21 |

## Execution

Wave 0 is implemented in this session (inline). Waves 1–3 wait until Wave 0 is verified.
