import { NextResponse } from "next/server";
import { buildSystemPrompt, callLlm, getLlmMode } from "@/lib/llm";
import { identity, projects, stats, stack, experience, education } from "@/lib/knowledge";

/**
 * POST /api/chat — LLM proxy.
 *
 * Client always renders via the rule-based engine first; when an LLM is
 * configured (NEXT_PUBLIC_LLM_MODE + LLM_API_KEY), this route enriches the
 * conversation with the knowledge base and returns the model's reply.
 * On ANY failure it returns { ok:false } so the UI silently falls back to
 * the rule-based engine — the site never breaks because an API is down.
 *
 * ⚙️ PLUG-IN POINT (more providers): add a branch in callLlm (lib/llm.ts).
 */

export const runtime = "nodejs";

// Compact, token-efficient knowledge summary for the system prompt.
function knowledgeSummary(): string {
  const proj = projects
    .map((p) => `- ${p.name} (${p.status}): ${p.tagline}. Stack: ${p.stack.join(", ")}.${p.impact ? " Impact: " + p.impact : ""}`)
    .join("\n");
  return [
    `Name: ${identity.name} — ${identity.tagline}. Location: ${identity.location}, Bangladesh.`,
    `Philosophy: "${identity.philosophy}"`,
    `Stats: ${stats.map((s) => `${s.value} ${s.label}`).join(", ")}.`,
    `Education: ${education.map((e) => `${e.degree}, ${e.org} (${e.period})${e.detail ? ". " + e.detail : ""}`).join(" | ")}`,
    `Experience: ${experience.map((e) => `${e.role} @ ${e.org} (${e.period})`).join(" | ")}`,
    `Projects:\n${proj}`,
    `Stack layers: ${stack.map((s) => `${s.layer}: ${s.items.slice(0, 8).join(", ")}`).join(" | ")}`,
  ].join("\n\n");
}

export async function POST(req: Request) {
  let body: { messages?: { role: string; content: string }[]; tone?: string; lang?: string; userName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad json" }, { status: 400 });
  }

  const msgs = (body.messages || [])
    .filter((m) => typeof m.content === "string" && m.content.length < 4000)
    .slice(-12); // token guard

  if (!msgs.length) return NextResponse.json({ ok: false, reason: "no messages" }, { status: 400 });

  const mode = getLlmMode();
  const apiKey = process.env.LLM_API_KEY;
  if (mode === "off" || !apiKey) {
    return NextResponse.json({ ok: false, reason: "llm not configured" }, { status: 200 });
  }

  try {
    const system = buildSystemPrompt(
      knowledgeSummary(),
      body.tone || "formal",
      body.lang || "en",
      body.userName
    );
    const text = await callLlm(
      [{ role: "system", content: system }, ...msgs.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))],
      mode,
      apiKey,
      process.env.LLM_MODEL
    );
    if (!text) throw new Error("empty reply");
    return NextResponse.json({ ok: true, text });
  } catch (err) {
    console.error("[api/chat]", err);
    return NextResponse.json({ ok: false, reason: "llm call failed" }, { status: 200 });
  }
}
