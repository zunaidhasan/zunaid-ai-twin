/**
 * Language detection — Bangla + English.
 *
 * Bangla (বাংলা) uses its own Unicode block (U+0980–U+09FF), so detection is
 * straightforward: count codepoints in the block vs. total letters.
 * Also catches "Banglish" (Bangla written in Latin script, e.g. "kemon acho",
 * "valo achi") with a curated keyword list — common in real BD conversations.
 */

const BANGLA_RANGE = /[\u0980-\u09FF]/g;
const ANY_LETTER = /[a-zA-Z\u0980-\u09FF]/g;

/** Common Banglish (romanized Bangla) tokens. */
const BANGLISH_TOKENS = [
  "kemon", "acho", "achen", "achen?", "valo", "bhalo", "ki khobor", "khobor",
  "kotha", "koro", "korchen", "koren", "ami", "tumi", "apni", "apnar", "amar",
  "kire", "mama", "dada", "bhai", "vai", "bondhu", "dhonnobad", "thik ache",
  "kothao", "keno", "kibhabe", "kivabe", "hobe", "hobe na", "accha", "acha",
  "ekdom", "onek", "beshi", "aja", "ajke", "kal", "ekhane", "oi", "eijje",
  "ki obostha", "jamela", "shala", "bujhen", "bujhi", "dekhi", "bolo", "bolen",
];

export type Lang = "bn" | "en";

export function detectLanguage(text: string): Lang {
  if (!text) return "en";
  const letters = text.match(ANY_LETTER);
  if (!letters) return "en";

  const banglaLetters = text.match(BANGLA_RANGE);
  // Any substantial Bangla script presence → Bangla.
  if (banglaLetters && banglaLetters.length / letters.length > 0.25) return "bn";

  const lower = ` ${text.toLowerCase()} `;
  const hits = BANGLISH_TOKENS.filter((t) => lower.includes(` ${t} `)).length;
  // Two+ Banglish tokens is a strong signal; one is not enough (e.g. "ami" is rare in EN anyway, but "kal" = December).
  if (hits >= 2) return "bn";

  return "en";
}

/** True when the user typed in Bangla or Banglish. */
export function isBangla(text: string): boolean {
  return detectLanguage(text) === "bn";
}

/* ------------------------------------------------------------------ */
/*  Common phrase translations used across the engine                  */
/* ------------------------------------------------------------------ */

export const bn = {
  greeting: "আসসালামু আলাইকুম! 🇧🇩",
  howAreYou: "আমি ভালো আছি, ধন্যবাদ! আপনি কেমন আছেন?",
  ask: "জিজ্ঞেস করুন",
  placeholder: "বাংলা বা English — যেভাবে খুশি লিখুন...",
  thinking: "ভাবছি...",
  listening: "শুনছি...",
  speak: "বলুন",
  send: "পাঠান",
};

/** A few romanized-friendly Bangla replies for the casual tone. */
export const bnCasual = [
  "একদম ঠিক আছে! 😄",
  "ব্যাপারটা ভালো লাগছে আমার কাছে।",
  "চলুন দেখি কী বানানো যায়।",
];
