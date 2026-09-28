# Zunaid Hasan · AI Twin 🇧🇩

A dark, immersive, production-grade **AI Twin** for [Zunaid Hasan](https://github.com/zunaidhasan) — AI Engineer · Voice AI Architect · Full-Stack Builder from Dhaka, Bangladesh.

Not a chatbot. A digital double with a real knowledge base, real projects, real numbers — and opinions about demo-ware.

> _"I build production AI systems — not demos."_

---

## ✨ What's inside

**Personality & conversation**
- 🧠 **Session memory** — remembers earlier questions and references them naturally ("back to DeshVox again?…"), persists across reloads, and remembers your name if you share it
- 🇧🇩 **Dual language** — seamless Bangla (বাংলা script) + Banglish (romanized) + English detection and replies, plus a `bangla mode` lock
- 🎭 **Tone modes** — Formal / Casual / Technical / Bangla-friendly, switchable or auto-detected per message
- 😄 **Signature personality** — production-first mindset, light humor, zero demo-ware tolerance
- ⌨️ **Special commands** — `matrix` · `bangla mode` · `english mode` · `show stats` · `roast my idea` · `architecture` · `help` · `contact` · `leave a message` · `share`

**Visual & sensory**
- 🌌 **Reactive starfield** — hue drifts with conversation topics (voice AI → violet, Bangla → green, roast → 🔥 red), bursts on new replies, leans toward your cursor — and **brightens, swells, and speeds up with the twin's voice amplitude**
- 🧑‍💻 **Living avatar** — big hero-sized 3D-tilt avatar: poke it for a bounce + greeting, watch dots orbit while thinking, ripples while listening, equalizer "lip-sync" while speaking
- 🎤 **Live mic meter** — real input-level bars; the mic button glows with your actual voice amplitude
- 🌊 **Voice-reactive visuals** — the avatar's glow and lip-sync bars pulse with the twin's speech cadence, and a sound-wave border races around the input bar while replies stream
- 🎨 **4 themes** — Studio Dark (default) · Bangladesh Green · Neon Terminal · Minimal Light (no flash on reload)
- 🗂️ **Rich project cards** — expand with description, stack chips, status pill, impact note, demo + GitHub links
- ⌨️ **Streaming replies** — typing effect with progressive payload reveal

**Intelligence & knowledge**
- ⚡ **Hybrid brain** — fast rule-based engine + structured knowledge base (always on, works offline) with an optional real-LLM path (OpenAI / Claude / Grok / custom) that falls back gracefully
- 🏗️ **Architecture deep dives** — ask `architecture` for real data-flow breakdowns (DeshVox, MaatiGyan, e-FuelCard…)
- 📝 **Leave a message** — posts to `/api/message` with plug-in points for Resend/Supabase
- 🔗 **Shareable conversations** — the whole chat is deflate-compressed into the URL hash; `/s/#z=…` renders it read-only with zero backend

**Utility & social**
- 🔘 **Contextual actions** — "View Live Demo", "Star on GitHub", "Connect on LinkedIn", "Book a Call" appear after relevant answers
- 🎙️ **Voice input + reply** — mic dictation (bn-BD/en-US) that auto-sends when you stop talking, plus SpeechSynthesis TTS with a **reply-voice picker** (Settings → Voice → ▶ preview) and a **hands-free conversation mode** where the mic reopens automatically after every spoken reply
- 📲 **PWA** — installable, offline shell, real avatar icons
- 📊 **Private analytics hooks** — local counters + optional POST sink, ready for a "most asked questions / popular projects" dashboard

---

## 🚀 Quick start

```bash
npm install
npm run icons   # fetch PWA icons from Zunaid's GitHub avatar (once)
npm run dev     # http://localhost:3000
```

Production:

```bash
npm run build
npm start
```

---

## 🧩 Project structure

```
app/
  page.tsx              # main chat interface (all wiring)
  layout.tsx            # fonts, SEO, PWA, theme boot
  globals.css           # 4 theme token sets + utilities
  s/page.tsx            # share-link viewer (/s/#z=...)
  api/chat/route.ts     # LLM proxy (keys stay server-side)
  api/message/route.ts  # leave-a-message endpoint
  api/analytics/route.ts# optional event sink
components/
  Starfield.tsx         # reactive ambient background
  Avatar.tsx            # glowing breathing avatar
  ChatBubble.tsx        # streaming bubble + markdown-lite
  ProjectCard.tsx       # expandable rich project card
  ActionRow.tsx         # contextual action buttons
  StatsGrid.tsx         # "show stats" grid
  MatrixRain.tsx        # "matrix" easter egg
  SharePanel.tsx        # share-link generator
  ContactPanel.tsx      # contact card
  LeaveMessageForm.tsx  # message-for-Zunaid form
  SuggestedChips.tsx    # opening chips
  MessageInput.tsx      # mic + send input
  SettingsPanel.tsx     # theme/tone/voice/memory drawer
lib/
  knowledge.ts          # ⭐ THE knowledge base — all of Zunaid's data
  engine.ts             # rule-based response engine (commands + intents)
  llm.ts                # LLM system prompt + provider adapters
  lang.ts               # Bangla/Banglish/English detection
  memory.ts             # session memory + recall
  voice.ts              # TTS + STT helpers
  share.ts              # conversation → URL encoding
  analytics.ts          # private event hooks
public/
  manifest.webmanifest, sw.js, icon-*.png
scripts/gen-icons.mjs   # PWA icon generator
```

**To update what the twin knows, edit `lib/knowledge.ts` only.**

---

## 🧠 Connecting a real LLM (optional)

The site is fully functional with zero API keys (rule-based engine). To level up:

1. Choose a provider and set env vars:

```bash
# .env.local
NEXT_PUBLIC_LLM_MODE=openai        # openai | claude | grok | custom
LLM_API_KEY=sk-...                 # server-side ONLY — never NEXT_PUBLIC_
LLM_MODEL=gpt-4o-mini              # optional override (e.g. claude-sonnet-4-20250514, grok-3)
```

2. Restart. The client now POSTs to `/api/chat`, which injects the full
   knowledge base as the system prompt and returns the model's reply.
   Any failure → silent fallback to the rule engine, so the twin never breaks.

3. For `custom` (OpenAI-compatible), also set `LLM_BASE_URL`.

> Keys never reach the browser: `/api/chat` is the only place they're used.

---

## 🎙️ Upgrading voice (optional)

Voice reply/input use the browser's built-in engines (zero cost, decent Bangla
on Chrome/Edge with a bn-BD voice installed). For voice cloning / premium TTS:

- Open `lib/voice.ts` → replace the inside of `speak()` with an
  **ElevenLabs** call (`eleven_multilingual_v2` handles Bangla + English) or
  **Azure TTS** / **Retell AI** — both already used in DeshVox.
- Keep the `speak(text, { lang, onStart, onEnd })` signature; the UI needs
  nothing else.
- For real lip-sync: drive `Avatar`'s `speaking` state from an
  `AnalyserNode` amplitude stream instead of the static equalizer.

---

## 📊 Wiring analytics (optional)

Events (`question`, `project_open`, `command_used`, `message_left`,
`share_created`, `voice_reply_toggled`) are counted locally and POST nowhere
by default. To collect:

```bash
NEXT_PUBLIC_ANALYTICS_URL=/api/analytics   # or a PostHog proxy / GA4 MP endpoint
```

The default sink just logs; see `app/api/analytics/route.ts` for a Supabase /
Vercel-KV sketch. Suggested dashboard queries: most-asked topics
(`props.topics`), popular projects (`project_open` by `props.id`).

---

## 📨 Real message delivery (optional)

`app/api/message/route.ts` currently logs server-side. To actually receive:

- **Resend**: `npm i resend`, add `RESEND_API_KEY`, use the snippet in the file.
- **Supabase**: insert into a `twin_messages` table.
- **Formspree-style**: set `NEXT_PUBLIC_FORM_ENDPOINT` and point the client
  form there instead.

---

## 🚢 Deploy

### Vercel (recommended — API routes just work)

```bash
npm i -g vercel
vercel            # preview
vercel --prod     # production
```

Or connect the repo in the Vercel dashboard — zero config needed.
Add env vars (if any) in Project → Settings → Environment Variables.

### Netlify

Add `netlify.toml` (included) — it uses the official Next.js runtime, so the
API routes work as Netlify Functions. Connect the repo, or:

```bash
npm i -g netlify-cli
netlify deploy --build --prod
```

### GitHub Pages (static-only mode)

API routes are serverless-only; for GitHub Pages remove the three `app/api`
folders and set `output: "export"` in `next.config.ts`. The rule-based brain,
voice, share links and themes all work fully static — only LLM/message
delivery need a server.

---

## ♿ Accessibility & performance

- Semantic landmarks, `role="log"` chat with polite live-region
- Visible focus states, skip-to-chat link, ARIA labels on all icon buttons
- `prefers-reduced-motion` respected (starfield renders a static frame)
- ~183 kB first load JS, static prerender, DPR-capped canvases

## 📄 Credits

Data sources: [github.com/zunaidhasan](https://github.com/zunaidhasan) ·
[zunaid.dev](https://zunaidhasan.github.io/zunaid.dev/) ·
[linkedin.com/in/zunaid-ishan](https://www.linkedin.com/in/zunaid-ishan/)
