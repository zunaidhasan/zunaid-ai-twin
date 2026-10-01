"use client";

/**
 * The single curated prompt set — 6 high-signal openers, one row.
 * Desktop: wraps/centers quietly under the hero. Mobile: horizontal scroll
 * with density (no wrap, no scrollbar). Hidden after the first user message.
 */
const PROMPTS = [
  { label: "Tell me about DeshVox", hint: "🎙️" },
  { label: "Who is Zunaid?", hint: "🧑‍💻" },
  { label: "What's your tech stack?", hint: "⚙️" },
  { label: "show stats", hint: "📊" },
  { label: "roast my idea", hint: "🔥" },
  { label: "bangla mode", hint: "🇧🇩" },
];

export default function SuggestedChips({ onPick, visible }: { onPick: (chip: string) => void; visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      role="group"
      aria-label="Suggested prompts"
      className="prompt-scroll no-scrollbar mx-auto flex max-w-3xl flex-wrap justify-center gap-2 px-4 pb-1.5 pt-1 sm:px-5"
    >
      {PROMPTS.map((p) => (
        <button key={p.label} onClick={() => onPick(p.label)} className="chip">
          <span aria-hidden className="text-[13px]">{p.hint}</span>
          {p.label}
        </button>
      ))}
    </div>
  );
}
