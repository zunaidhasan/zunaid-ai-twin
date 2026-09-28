/**
 * Response engine — the fast brain.
 *
 * Hybrid design:
 *   1. Special commands ("matrix", "show stats", "roast my idea"…) → instant
 *   2. Knowledge-base matching (projects, stack, experience…) → reliable
 *   3. Fallback conversational replies → personality
 *   4. If a real LLM is connected (lib/llm.ts + /api/chat), the UI prefers it
 *      for anything non-command; this engine still handles commands so they
 *      always work even offline.
 *
 * ⚙️ PLUG-IN POINT (more intelligence): add patterns to INTENTS below —
 * each intent is [regex, reply-builder]. Order matters: first match wins.
 */

import {
  projects,
  identity,
  stats,
  stack,
  experience,
  education,
  certifications,
  commStats,
  commWorkflow,
  designPrinciple,
  matrixLines,
  roasts,
  architectureWisdom,
  type Project,
} from "./knowledge";
import { isBangla, type Lang } from "./lang";
import { buildRecall, recallPhrase, type Msg, getLastProject } from "./memory";
import { localCounts } from "./analytics";

export type Tone = "formal" | "casual" | "technical" | "bangla" | "auto";

export type Action = { label: string; url: string; icon?: string };
export type TwinPayload =
  | { kind: "project"; projectId: string }
  | { kind: "actions"; actions: Action[] }
  | { kind: "stats" }
  | { kind: "chips"; items: string[] }
  | { kind: "contact" }
  | { kind: "leave-message" }
  | { kind: "matrix" }
  | { kind: "share" };

export type TwinReply = {
  text: string;
  payload?: TwinPayload;
  lang: Lang;
  /** Project id to pulse in the constellation sidebar, if any */
  projectId?: string;
};

export type EngineContext = {
  tone: Tone;
  history: Msg[];
  /** Twin-side lang toggle ("bangla mode" command). Null = auto-detect per message. */
  langLock: Lang | null;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const humor = [
  "Production, not demos. House rules. 😄",
  "That's not a demo question — that's a shipping question. I approve.",
  "I ran this through my internal code review. It passed. Barely. 😄",
  "Fun fact: every stat here is real. I know, refreshing.",
  "Dhaka traffic can't stop the deploy pipeline. 🇧🇩",
  "I could answer in bullet points, but bullets are a demo. Here's the production version:",
];

function detectTone(input: string, current: Tone): Exclude<Tone, "auto"> {
  if (current !== "auto") return current;
  if (isBangla(input)) return "bangla";
  if (/\b(architecture|latency|pipeline|vector|rag|fine[- ]?tun|scal(e|ing)|infra|api|async|throughput)\b/i.test(input))
    return "technical";
  if (/\b(hey|yo|sup|haha|lol|bro|bhai|mama|kire|fun|joke)\b/i.test(input)) return "casual";
  return "formal";
}

/** Finds a project by keywords/name mention. */
function matchProject(input: string): Project | undefined {
  const q = input.toLowerCase();
  let best: { p: Project; score: number } | undefined;
  for (const p of projects) {
    let score = 0;
    for (const kw of p.keywords) {
      if (q.includes(kw)) score += kw.length;
    }
    if (q.includes(p.name.toLowerCase())) score += 10;
    if (score > 0 && (!best || score > best.score)) best = { p, score };
  }
  return best?.p;
}

/* ------------------------------------------------------------------ */
/*  Special commands                                                   */
/* ------------------------------------------------------------------ */

type CommandResult = TwinReply | undefined;

function runCommands(raw: string, ctx: EngineContext): CommandResult {
  const q = raw.toLowerCase().trim();
  const reply = (text: string, payload?: TwinPayload): TwinReply => ({
    text,
    payload,
    lang: ctx.langLock || (isBangla(raw) ? "bn" : "en"),
  });

  // "matrix"
  if (/\bmatrix\b/.test(q)) {
    return reply(
      "Wake up, visitor… 🕶️ The matrix view is live on the side panel. `while (true) { build(); ship(); iterate(); }` — the Zunaid saga in one line.",
      { kind: "matrix" }
    );
  }

  // "bangla mode" / "english mode"
  if (/\b(bangla mode|bangla on|বাংলা মোড)\b/.test(q)) {
    return { text: "বাংলা মোড চালু! 🇧🇩 এখন থেকে আমি বাংলায় উত্তর দেব। কী জানতে চাও — DeshVox নাকি MaatiGyan?", lang: "bn" };
  }
  if (/\b(english mode|english on)\b/.test(q)) {
    return reply("English mode on. 🇬🇧 Ask me anything — DeshVox, RAG pipelines, or why I refuse to ship demos.");
  }

  // "show stats" / "stats"
  if (/\b(show stats|stats|স্ট্যাটস)\b/.test(q)) {
    const c = localCounts();
    const asked = c.question || 0;
    const lines = [
      `📊 **Session intel:** ${asked} question${asked === 1 ? "" : "s"} asked here.`,
      asked >= 3 ? "You're doing recon like a proper engineer. Respect." : "Warm-up level. Go deeper.",
      "",
      "**The real numbers behind this twin:**",
      ...stats.map((s) => `- ${s.value} ${s.label}`),
    ];
    return reply(lines.join("\n"), { kind: "stats" });
  }

  // "roast my idea"
  if (/\broast\b/.test(q)) {
    return reply(pick(roasts));
  }

  // "architecture"
  if (/\barchitecture\b/.test(q)) {
    const p = matchProject(raw) || projects.find((x) => x.id === (getLastProject() || "deshvox"));
    const body = p?.architecture
      ? `**${p.name} — how it's actually wired:**\n\n${p.architecture}`
      : pick(architectureWisdom);
    return reply(
      `${body}\n\n_${designPrinciple}_`,
      p ? { kind: "actions", actions: [{ label: "View GitHub", url: p.github || identity.github, icon: "🐙" }] } : undefined
    );
  }

  // "help" / commands list
  if (/^(help|commands|what can you do)/.test(q)) {
    return reply(
      [
        "Here's my cheat sheet 🗂️",
        "",
        "- **Projects** — ask about *DeshVox, MaatiGyan, LegalMate AI, e-FuelCard…*",
        "- `matrix` — enter the terminal 🕶️",
        "- `bangla mode` / `english mode` — switch my language",
        "- `show stats` — session + career numbers",
        "- `roast my idea` — pitch anything, get honest fire 🔥",
        "- `architecture` — how the systems are wired",
        "- `contact` / `leave a message` — reach the human",
        "- `share` — get a link to our conversation",
        "",
        "Tone panel (top-right) switches me between formal / casual / technical.",
      ].join("\n"),
      { kind: "chips", items: ["Tell me about DeshVox", "show stats", "architecture", "roast my idea"] }
    );
  }

  // "share"
  if (/\b(share|shareable link|conversation link)\b/.test(q)) {
    return reply("Generating a share link of our chat…", { kind: "share" });
  }

  // "contact"
  if (/\b(contact|email|phone|reach)\b/.test(q)) {
    return reply(
      "The human behind this twin responds within 24h (usually much less — it's a professional obsession):",
      { kind: "contact" }
    );
  }

  // "leave a message" / leave-message
  if (/\b(leave (a )?message|message for zunaid|feedback)\b/.test(q)) {
    return reply(
      "Sure — drop a note below. It is logged on the server for now; email delivery is not wired yet. For anything urgent, email connect.zunaid@gmail.com.",
      { kind: "leave-message" }
    );
  }

  // "clear"
  if (/^(clear|reset|forget everything)\b/.test(q)) {
    return reply("To forget me, use the ↺ button in the header — it wipes our session memory. (I'll pretend that's not emotionally devastating. 🥲)");
  }

  // "who are you" handled by intents, but "are you real / ai"
  if (/\b(are you (an? )?(real|ai|human|bot)|who (are|made) you)\b/.test(q)) {
    return reply(
      `I'm Zunaid's **AI Twin** — a digital double running on his real knowledge base: ${stats[0].value} projects, ${stats[3].value} AI systems, and opinions about demo-ware. The human is in Dhaka 🇧🇩 building DeshVox; I'm here, always on.`
    );
  }

  return undefined;
}

/** Special commands only — used by the UI so `matrix` / `share` / etc.
 *  still win when an LLM is connected. */
export function tryCommand(raw: string, ctx: EngineContext): TwinReply | undefined {
  return runCommands(raw, ctx);
}

/* ------------------------------------------------------------------ */
/*  Intent handlers (knowledge topics)                                 */
/* ------------------------------------------------------------------ */

function projectReply(p: Project, tone: string, recall: string): TwinReply {
  const openers: Record<string, string[]> = {
    formal: [`Let me brief you on **${p.name}**.`, `Here's the production story of **${p.name}**.`],
    casual: [`Oh, **${p.name}** — good pick. 😄`, `**${p.name}**! My favorite thing to brag about. 🇧🇩`],
    technical: [`**${p.name}** — let's get into the weeds.`, `**${p.name}**. Architecture-first rundown:`],
    bangla: [`**${p.name}** নিয়ে বলি! 🇧🇩`, `**${p.name}** — এটা আমার স্পেশাল প্রজেক্ট।`],
  };
  const opener = pick(openers[tone] || openers.formal);
  const impact = p.impact ? `\n\n**Why it matters:** ${p.impact}` : "";
  const statusLine = p.status ? `\n\n**Status:** ${p.status}` : "";

  const actions: Action[] = [];
  if (p.demo) actions.push({ label: "View Live Demo", url: p.demo, icon: "🚀" });
  if (p.github) actions.push({ label: "Star on GitHub", url: p.github, icon: "⭐" });
  actions.push({ label: "Book a Call", url: identity.bookCall, icon: "📞" });

  const closers: Record<string, string> = {
    formal: "Shall I go deeper on the architecture?",
    casual: "Wanna see how it's wired under the hood? Ask me for the architecture. 😄",
    technical: "Say `architecture` and I'll draw the data flow from memory.",
    bangla: "আর্কিটেকচার দেখতে চাইলে বলো!",
  };

  return {
    text: `${recall}${opener}\n\n${p.description}${statusLine}${impact}\n\n${closers[tone] || closers.formal}`,
    payload: { kind: "project", projectId: p.id },
    lang: tone === "bangla" ? "bn" : "en",
    projectId: p.id,
  };
}

function handleIntents(raw: string, tone: string, recall: string, lang: Lang): TwinReply | undefined {
  const q = raw.toLowerCase();

  // Greetings
  if (/^(hi|hello|hey|yo|salam|assalamu alaikum|asalamualaikum|আসসালামু|হ্যালো|হাই)\b/.test(q) || /^(hola|namaste)/.test(q)) {
    const texts: Record<string, string[]> = {
      formal: [
        "Welcome. I'm Zunaid Hasan's AI Twin — ask me about his projects, stack, or how he ships production AI from Dhaka. 🇧🇩",
        "Good to have you. I run on Zunaid's real track record — 15+ projects, 8+ AI systems. What would you like to explore?",
      ],
      casual: [
        "Hey hey! 👋 I'm the Zunaid twin. Fair warning: I only talk about production AI, Bangla NLP, and the occasional Dhaka traffic joke. What's up?",
        "Yo! 👋 Welcome. Ask me about DeshVox, voice agents, or literally type `matrix` if you're feeling cinematic. 🕶️",
      ],
      technical: [
        "System online. Ask about DeshVox's voice pipeline, RAG infra, or the Bangla NLP stack — I go deep.",
        "Twin booted. Interests I can satisfy: voice AI architecture, RAG pipelines, Next.js/FastAPI patterns. Query away.",
      ],
      bangla: [
        "আসসালামু আলাইকুম! 🇧🇩 আমি জুনায়েদের AI টুইন। DeshVox, MaatiGyan — যা জানতে চাও, বলো!",
        "হ্যালো! 👋 বাংলায় প্রশ্ন করো বা English-এ — দুটোতেই চলে।",
      ],
    };
    return { text: pick(texts[tone] || texts.formal), lang, payload: { kind: "chips", items: ["Tell me about DeshVox", "What's your stack?", "show stats", "roast my idea"] } };
  }

  // How are you
  if (/\b(how are you|kemon acho|kemon achen|কেমন আছ)\b/.test(q)) {
    if (lang === "bn") return { text: "আমি ভালো আছি — সার্ভার ঠান্ডা, লেটেন্সি কম, মুড প্রোডাকশন-রেডি! 😄 আপনি কেমন আছেন?", lang: "bn" };
    return {
      text: pick([
        "Running at production-grade happiness: low latency, zero downtime, mood = shipping. How about you? 😄",
        "Great — my uptime is 99.99% and my coffee intake mirrors Zunaid's. What brings you here?",
      ]),
      lang,
    };
  }

  // Identity / who is Zunaid
  if (/\b(who is zunaid|about zunaid|zunaid hasan|who are you|introduce|yourself)\b/.test(q)) {
    return {
      text: `${recall}**Zunaid Hasan** — ${identity.tagline}, based in ${identity.location} 🇧🇩.\n\nCurrently: Foreign Communication Executive at Sardar IT by day, building **DeshVox** (Bangladesh's first AI-powered cloud call center) in every other hour. B.Sc. in CSE from Daffodil International University, thesis on deep-learning plant identification.\n\n> _"${identity.philosophy}"_\n\nAsk me about any project — or type \`help\` for tricks.`,
      lang,
      payload: { kind: "actions", actions: [
        { label: "Connect on LinkedIn", url: identity.linkedin, icon: "💼" },
        { label: "GitHub", url: identity.github, icon: "🐙" },
        { label: "Portfolio", url: identity.portfolio, icon: "🌐" },
      ] },
    };
  }

  // Philosophy / mindset
  if (/\b(philosophy|mindset|motto|why production|values)\b/.test(q)) {
    return {
      text: `${recall}The house philosophy:\n\n> _"${identity.philosophy}"_\n\nIn practice: RAG before fine-tuning, latency budgets per hop, Bangla support in the data model from day one — and no project ships without handling the 10x-growth question.`,
      lang,
    };
  }

  // Projects — single match
  const p = matchProject(raw);
  if (p) {
    return projectReply(p, tone, recall);
  }

  // "projects" plural / all work
  if (/\b(projects?|portfolio|work|built|ship(ped)?|showcase)\b/.test(q)) {
    const lines = projects.slice(0, 8).map((x) => `${x.emoji} **${x.name}** — ${x.tagline} _(${x.status})_`);
    return {
      text: `${recall}Here's the highlight reel — ${stats[0].value} projects total, these are the headliners:\n\n${lines.join("\n")}\n\nAsk about any by name for the full card + links.`,
      lang,
      payload: { kind: "chips", items: ["DeshVox", "MaatiGyan", "LegalMate AI", "e-FuelCard"] },
    };
  }

  // Tech stack
  if (/\b(tech stack|stack|technologies|skills?|tools?)\b/.test(q)) {
    const lines = stack.map((s) => `${s.icon} **${s.layer}** — ${s.items.slice(0, 6).join(", ")}…`);
    return {
      text: `${recall}The production arsenal:\n\n${lines.join("\n")}\n\n${stats[4].value} APIs integrated and counting. Ask me how any layer fits together.`,
      lang,
    };
  }

  // Voice AI specifically (DeshVox keywords may catch, but direct Qs about voice tech)
  if (/\b(voice (ai|agent|bot)|tts|text.to.speech|elevenlabs|retell)\b/.test(q)) {
    return {
      text: `${recall}Voice AI is the current obsession. In DeshVox: **Retell AI** handles real-time ASR + turn-taking, **Claude** reasons with a Pinecone-backed business KB, and **ElevenLabs / Azure TTS** synthesize Bangla + English. The hard part isn't the models — it's keeping total latency under ~800ms so conversations feel human.\n\nBangla TTS is where most platforms fall over. We didn't. 🇧🇩`,
      lang,
      projectId: "deshvox",
      payload: { kind: "project", projectId: "deshvox" },
    };
  }

  // Bangla / NLP
  if (/\b(bangla|bengali|nlp|bilingual|বাংলা)\b/.test(q)) {
    return {
      text: `${recall}Bangla-first isn't a checkbox — it's the moat. From **MaatiGyan** (soil reports in Bangla via WhatsApp) to **LegalMate AI** (Bangla legal guidance) to DeshVox's bilingual voice agents, the pattern is: transliteration-aware search, Bangla-native prompts, and testing with real Dhaka accents, not textbook audio.`,
      lang,
      payload: { kind: "chips", items: ["Tell me about MaatiGyan", "LegalMate AI", "Voice AI stack"] },
    };
  }

  // Experience / career
  if (/\b(experience|career|job|worked|background|history|resume|cv)\b/.test(q)) {
    const lines = experience.map((e) => `- **${e.role}** · ${e.org} — ${e.period}`);
    return {
      text: `${recall}Career timeline:\n\n${lines.join("\n")}\n\nCurrently at **Sardar IT** bridging foreign clients with engineering teams — which is why this twin answers like a project manager with a compiler.`,
      lang,
      payload: { kind: "actions", actions: [{ label: "View Resume", url: identity.resume, icon: "📄" }, { label: "Connect on LinkedIn", url: identity.linkedin, icon: "💼" }] },
    };
  }

  // Education
  if (/\b(education|study|university|degree|thesis|daffodil|cse)\b/.test(q)) {
    const e = education[0];
    return {
      text: `${recall}**${e.degree}** — ${e.org} (${e.period}).\n\n${e.detail}\n\nPlus: ${e.extra.join(" · ")}. The thesis was deep-learning plant ID — dataset contribution + benchmarking, basically teaching a CNN to know its weeds. 😄`,
      lang,
    };
  }

  // Certifications
  if (/\b(certif|credential|courses)\b/.test(q)) {
    const lines = certifications.map((c) => `- **${c.name}** — ${c.issuer}`);
    return { text: `${recall}Certifications on file:\n\n${lines.join("\n")}`, lang };
  }

  // Communication / client work
  if (/\b(client|communication|international|sardar|countries|satisfaction)\b/.test(q)) {
    const lines = commWorkflow.map((w, i) => `${i + 1}. ${w}`);
    return {
      text: `${recall}The client-facing side:\n\n${commStats.map((s) => `**${s.value}** ${s.label}`).join(" · ")}\n\nWorkflow:\n${lines.join("\n")}`,
      lang,
    };
  }

  // AI/ML general
  if (/\b(ai|machine learning|deep learning|model|llm|gpt|claude|rag|pytorch|tensorflow)\b/.test(q)) {
    return {
      text: `${recall}${stats[3].value} AI systems shipped — the pattern that works: start with RAG (Pinecone + smart chunking), add fine-tuning only when retrieval genuinely isn't enough, and always validate against edge cases before "launch". From YOLOv5 detection to RNN/GAN music generation to production voice agents — the discipline is the same.`,
      lang,
      payload: { kind: "chips", items: ["Tell me about DeshVox", "RAG in MaatiGyan", "architecture"] },
    };
  }

  // Hire / work together
  if (/\b(hire|freelance|collaborate|work together|available|opportunit)\b/.test(q)) {
    return {
      text: `${recall}Zunaid's open to opportunities — AI engineering, voice agents, full-stack builds. Fastest routes:`,
      lang,
      payload: { kind: "actions", actions: [
        { label: "Connect on LinkedIn", url: identity.linkedin, icon: "💼" },
        { label: "Email", url: `mailto:${identity.email}`, icon: "✉️" },
        { label: "Book a Call", url: identity.bookCall, icon: "📞" },
      ] },
    };
  }

  // Thanks
  if (/\b(thanks|thank you|dhonnobad|ধন্যবাদ)\b/.test(q)) {
    return { text: pick(["Always. Go build something real. 🚀", "Anytime — that's what twins are for. 😄", lang === "bn" ? "স্বাগতম! 🚀" : "Anytime. 🚀"]), lang };
  }

  return undefined;
}

/* ------------------------------------------------------------------ */
/*  Fallbacks                                                          */
/* ------------------------------------------------------------------ */

function fallback(raw: string, tone: string, recall: string, lang: Lang): TwinReply {
  if (lang === "bn") {
    return {
      text: `${recall}মজার প্রশ্ন! এটা নিয়ে আমার নলেজ-বেসে সরাসরি ডেটা নেই, তবে জুনায়েদ এটা নিজের মতো করে ভেবে দেখতে ভালোবাসে। 🤔\n\nআমি এই বিষয়গুলোয় খুব ভালো — প্রজেক্ট, টেক স্ট্যাক, ভয়েস AI, বাংলা NLP। চাইলে \`leave a message\` লিখে জুনায়েদকে সরাসরি নোট পাঠাতে পারো।`,
      lang,
      payload: { kind: "chips", items: ["DeshVox সম্পর্কে বলো", "টেক স্ট্যাক কী?", "leave a message"] },
    };
  }
  const texts: Record<string, string[]> = {
    formal: [
      `${recall}Interesting question — outside my knowledge base, so I won't improvise facts. What I *can* brief you on: projects, stack, voice AI, Bangla NLP, or the production philosophy. Or type \`leave a message\` and the human himself replies.`,
      `${recall}That's beyond my hardcoded brain, and I'd rather admit that than demo-ware you. Try asking about DeshVox, the tech stack, or how the client workflow runs.`,
    ],
    casual: [
      `${recall}Hmm, that one's outside my firmware. 😅 But ask me about voice agents, Bangla NLP or the projects and I get *very* talkative.`,
      `${recall}404: answer not found in knowledge base. 🙃 Type \`help\` to see what I'm actually great at — or \`roast my idea\` if you brought one.`,
    ],
    technical: [
      `${recall}Out of scope for my retrieval layer — no confident match in the KB. I index: projects, stack layers, experience, and architecture patterns. Query within those and I'm precise.`,
      `${recall}No KB hit for that, and I don't hallucinate — production habit. Reframe around DeshVox, RAG, or the stack and we're golden.`,
    ],
    bangla: [`${recall}এটা নিয়ে নিশ্চিত তথ্য নেই, কিন্তু প্রজেক্ট, স্ট্যাক বা ভয়েস AI নিয়ে জিজ্ঞেস করলে বিস্তারিত বলতে পারবো!`],
  };
  return {
    text: pick(texts[tone] || texts.formal),
    lang,
    payload: { kind: "chips", items: ["Tell me about DeshVox", "What's your stack?", "architecture", "leave a message"] },
  };
}

/* ------------------------------------------------------------------ */
/*  Main entry                                                         */
/* ------------------------------------------------------------------ */

export function generateReply(raw: string, ctx: EngineContext): TwinReply {
  const input = raw.trim();
  const tone = detectTone(input, ctx.tone);
  const lang: Lang = ctx.langLock || (isBangla(input) ? "bn" : "en");
  const recall = recallPhrase(buildRecall(ctx.history));

  // 1) Commands always win.
  const cmd = tryCommand(input, ctx);
  if (cmd) return cmd;

  // 2) Knowledge intents.
  const intent = handleIntents(input, tone, recall, lang);
  if (intent) return intent;

  // 3) Personality fallback.
  return fallback(input, tone, recall, lang);
}

/** First-load greeting. */
export function greetingReply(): TwinReply {
  return {
    text: `আসসালামু আলাইকুম / Hello! 👋\n\nI'm **Zunaid Hasan's AI Twin** — a digital double running on his real work: ${stats[0].value} projects, ${stats[3].value} AI systems, and a production-first philosophy from ${identity.location} 🇧🇩\n\nAsk me anything — or try \`matrix\`, \`show stats\`, or \`roast my idea\` if you want the full experience.`,
    lang: "en",
    payload: { kind: "chips", items: ["Tell me about DeshVox", "What's your tech stack?", "Who is Zunaid?", "show stats", "roast my idea"] },
  };
}
