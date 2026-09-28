"use client";

const DEFAULT_CHIPS = [
  "Tell me about DeshVox",
  "Who is Zunaid?",
  "What's your tech stack?",
  "show stats",
  "roast my idea",
  "bangla mode",
];

/** Opening suggestion chips shown above the input until the user engages. */
export default function SuggestedChips({ onPick, visible }: { onPick: (chip: string) => void; visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="mx-auto flex max-w-3xl flex-wrap justify-center gap-2 px-4 pb-1 pt-2">
      {DEFAULT_CHIPS.map((c) => (
        <button
          key={c}
          onClick={() => onPick(c)}
          className="rounded-full px-3.5 py-1.5 text-[12.5px] transition hover:-translate-y-0.5"
          style={{ background: "var(--surface)", border: "1px solid var(--line)", color: "var(--text-2)", boxShadow: "var(--shadow-soft)" }}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
