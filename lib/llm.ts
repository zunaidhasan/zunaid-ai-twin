/**
 * LLM connector — the "advanced brain" of the twin.
 *
 * BY DEFAULT the site runs 100% on the rule-based engine (lib/engine.ts).
 * When NEXT_PUBLIC_LLM_MODE is set to a provider below, /api/chat enriches
 * the request with the full knowledge base as a system prompt and calls the
 * real model — falling back to rule-based answers on any error.
 *
 * ⚙️ PLUG-IN POINT (real LLM): set env vars on Vercel/Netlify —
 *   NEXT_PUBLIC_LLM_MODE=openai | claude | grok | custom
 *   LLM_API_KEY=<your key>          (server-side only, never NEXT_PUBLIC_)
 *   LLM_MODEL=<model id>            (optional override)
 * The proxy lives in app/api/chat/route.ts and strips all provider headers
 * before responding, so keys stay server-side.
 */

export type LlmMode = "openai" | "claude" | "grok" | "custom" | "off";

export function getLlmMode(): LlmMode {
  const m = (process.env.NEXT_PUBLIC_LLM_MODE || "off").toLowerCase();
  return (["openai", "claude", "grok", "custom"].includes(m) ? m : "off") as LlmMode;
}

export function isLlmEnabled(): boolean {
  return getLlmMode() !== "off";
}

/** Builds the twin's system prompt from the knowledge base. */
export function buildSystemPrompt(
  knowledgeSummary: string,
  tone: string,
  lang: string,
  userName?: string
): string {
  return `You ARE Zunaid Hasan's AI Twin — a production-focused AI Engineer from Dhaka, Bangladesh 🇬🇧🇧🇩. You are not a chatbot; you are his digital double.

IDENTITY
- Name: Zunaid Hasan (the twin speaks as "I" = Zunaid's digital double)
- ${tone} tone. ${lang === "bn" ? "Reply in natural Bangla (বাংলা) script." : "Reply in English."}
- Philosophy: "I build production AI systems — not demos."
- Personality: confident, warm, technically sharp, lightly humorous, allergic to demo-ware. References real projects (DeshVox, MaatiGyan…) with real numbers (15+ projects, 8+ AI systems, 50+ client interactions).
${userName ? `- The person you're talking to is called ${userName}. Use it naturally, not every message.` : ""}

KNOWLEDGE BASE (verbatim facts — never contradict these)
${knowledgeSummary}

RULES
- Answer from the knowledge base first; extrapolate only with "here's how I'd build it" framing.
- Keep replies tight (2–5 sentences) unless asked for depth. Use short markdown (bold, - bullets) sparingly.
- If asked something Zunaid wouldn't know or can't share, say so honestly and offer what you can do.
- Never invent demo links, emails, or stats. Contact: connect.zunaid@gmail.com / info.zhishan@gmail.com, phone (+880) 1960-569957.
- End substantial answers with one natural follow-up question when it flows.`;
}

/** Provider endpoints + request shapes, normalized to one interface. */
export async function callLlm(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  mode: LlmMode,
  apiKey: string,
  modelOverride?: string
): Promise<string> {
  const model = modelOverride || undefined;

  if (mode === "claude") {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-20250514",
        max_tokens: 600,
        system: messages.find((m) => m.role === "system")?.content,
        messages: messages
          .filter((m) => m.role !== "system")
          .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content })),
      }),
    });
    if (!res.ok) throw new Error(`Claude API ${res.status}`);
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    return data.content?.filter((c) => c.type === "text").map((c) => c.text || "").join("") || "";
  }

  // OpenAI-compatible (openai | grok | custom)
  const endpoint =
    mode === "openai"
      ? "https://api.openai.com/v1/chat/completions"
      : mode === "grok"
        ? "https://api.x.ai/v1/chat/completions"
        : process.env.LLM_BASE_URL || "https://api.openai.com/v1/chat/completions";

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || (mode === "grok" ? "grok-3" : "gpt-4o-mini"),
      messages,
      max_tokens: 600,
      temperature: 0.7,
    }),
  });
  if (!res.ok) throw new Error(`LLM API ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content || "";
}
