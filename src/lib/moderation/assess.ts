import { foldTr } from "@/lib/tr";

// Otomatik içerik denetimi (spec 2026-11-27 §3). Saf işlevdir: ilan metnini okur, işaretler ve puan
// döndürür. Puanı eşik ya da üstü olan ilan editör onayına kadar yayına girmez. Amaç kesin hüküm değil,
// şüpheliyi editörün önüne koymaktır; yanlış pozitif yalnız bekleme demektir, ilan silinmez.

export const HOLD_THRESHOLD = 3;

export type FlagCode =
  | "PHONE"
  | "PROFANITY"
  | "ADVERTISING"
  | "PAID_WORK"
  | "EMAIL"
  | "LINK"
  | "DUPLICATE"
  | "BURST"
  | "SHOUTING"
  | "REPEATED_CHARS";

export const FLAG_LABELS: Record<FlagCode, string> = {
  PHONE: "Telefon numarası",
  PROFANITY: "Küfür veya hakaret",
  ADVERTISING: "Reklam veya satış dili",
  PAID_WORK: "Ücretli ödev, tez veya proje yazdırma",
  EMAIL: "E-posta adresi",
  LINK: "Bağlantı",
  DUPLICATE: "Tekrarlanan ilan",
  BURST: "Kısa sürede çok ilan",
  SHOUTING: "Büyük harf seli",
  REPEATED_CHARS: "Uzun karakter tekrarı",
};

export interface ContentInput {
  title: string;
  summary: string;
  description: string;
  tags?: string[];
  roles?: Array<{ title: string; description?: string | null }>;
}

/** Sahibin yakın geçmişi; veritabanından okunur, işleve hazır verilir. */
export interface OwnerHistory {
  /** Son 7 gündeki başka ilanların başlık ve açıklamaları. */
  recent: Array<{ title: string; description: string }>;
  /** Son 24 saatte açtığı ilan sayısı (bu ilan hariç). */
  createdLast24h: number;
}

export interface Assessment {
  score: number;
  flags: FlagCode[];
  hold: boolean;
}

// Katlanmış (foldTr) metinde, kelime sınırıyla aranır. Kökler: "satilik" "satiliktir"i de yakalar.
// Yalnız açıkça ticari ifadeler. "fiyat", "kripto", "sipariş", "kampanya" gibi kelimeler meşru proje
// konularında da geçtiği için listede yoktur.
const ADVERTISING_ROOTS = [
  "indirim",
  "satilik",
  "satiyorum",
  "ucretsiz kargo",
  "kargo bedava",
  "para kazan",
  "evden kazan",
  "pasif gelir",
  "yatirim firsati",
  "bahis",
  "iddaa",
  "casino",
  "kumar",
  "forex",
  "borsa sinyal",
  "takipci sat",
  "begeni sat",
  "referans kodu",
  "promosyon kodu",
  "kupon kodu",
  "whatsapp",
  "telegram",
  "dm at",
  "dmden",
];

const PAID_WORK_PATTERNS = [
  /\bodev(ler)?\s+(yapilir|yaptirilir|yaptirma|yazilir|hazirlanir)/,
  /\btez\s+(yazilir|yaptirilir|yazdirma|hazirlanir|yazimi)/,
  /\bproje(ler)?\s+(yapilir|yaptirilir|yazilir)\b/,
  /\bucret\s*(li|karsiligi)\b.*\b(odev|tez|proje)/,
  /\b(odev|tez|proje)\b.*\bucret\s*(li|karsiligi)/,
  /\bpara\s+karsiligi\b/,
];

// Kısa ve bilinçli olarak dar tutulan küfür kökleri (katlanmış metin, kelime başı).
const PROFANITY_ROOTS = ["orospu", "siktir", "sikerim", "yarrak", "got veren", "anani sik"];
// Kısa olanlar yalnız tam kelime olarak eşleşir ("aquarium", "picnic" gibi kelimeler yakalanmasın).
const PROFANITY_WORDS = ["amk", "aq", "pic", "mk", "oc"];

// Projelerde olağan olan profesyonel bağlantılar puan almaz.
const TRUSTED_LINK_HOSTS = [
  "github.com",
  "gitlab.com",
  "figma.com",
  "behance.net",
  "dribbble.com",
  "linkedin.com",
  "kaggle.com",
  "huggingface.co",
  "edu.tr",
];
// Nokta içeren teknoloji adları bağlantı sayılmaz.
const NOT_LINKS = ["asp.net", "vb.net", "ado.net"];

const LINK_PATTERN = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(?:com|net|org|io|co|me|ly|gl|xyz|shop|store|tr)(?:\.[a-z]{2})?\b(?:\/\S*)?/gi;
const EMAIL_PATTERN = /\b[^\s@]+@[^\s@]+\.[a-z]{2,}\b/i;
// 05xx xxx xx xx, +90 5xx..., 0 (5xx) ...; araya boşluk, tire, nokta girebilir.
const PHONE_PATTERN = /(?:\+?90[\s.-]?)?\(?0?5\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}\b/;

function hasWord(folded: string, word: string): boolean {
  return new RegExp(`(?:^|\\s)${word}(?:\\s|$)`).test(folded);
}

function hasRoot(folded: string, root: string): boolean {
  const escaped = foldTr(root).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)${escaped}`).test(folded);
}

function normalizeForCompare(text: string): string {
  return foldTr(text);
}

export function assessContent(input: ContentInput, history: OwnerHistory = { recent: [], createdLast24h: 0 }): Assessment {
  const roleText = (input.roles ?? []).flatMap((role) => [role.title, role.description ?? ""]);
  const raw = [input.title, input.summary, input.description, ...(input.tags ?? []), ...roleText].join("\n");
  const folded = foldTr(raw);

  const flags: FlagCode[] = [];
  let score = 0;
  const add = (flag: FlagCode, points: number) => {
    flags.push(flag);
    score += points;
  };

  if (PHONE_PATTERN.test(raw)) add("PHONE", 3);
  if (PROFANITY_ROOTS.some((root) => hasRoot(folded, root)) || PROFANITY_WORDS.some((word) => hasWord(folded, word))) {
    add("PROFANITY", 3);
  }
  if (PAID_WORK_PATTERNS.some((pattern) => pattern.test(folded))) add("PAID_WORK", 3);
  if (ADVERTISING_ROOTS.some((root) => hasRoot(folded, root))) add("ADVERTISING", 2);
  if (EMAIL_PATTERN.test(raw)) add("EMAIL", 2);

  const withoutEmails = raw.replace(new RegExp(EMAIL_PATTERN.source, "gi"), " ");
  const links = (withoutEmails.match(LINK_PATTERN) ?? []).filter((link) => {
    const lower = link.toLowerCase();
    if (NOT_LINKS.includes(lower)) return false;
    const host = lower.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    return !TRUSTED_LINK_HOSTS.some((trusted) => host === trusted || host.endsWith(`.${trusted}`));
  });
  if (links.length >= 2) add("LINK", 3);
  else if (links.length === 1) add("LINK", 2);

  const title = normalizeForCompare(input.title);
  const description = normalizeForCompare(input.description);
  const duplicate = history.recent.some(
    (other) =>
      (title.length > 0 && normalizeForCompare(other.title) === title) ||
      (description.length >= 40 && normalizeForCompare(other.description) === description),
  );
  if (duplicate) add("DUPLICATE", 2);
  if (history.createdLast24h >= 2) add("BURST", 2);

  const letters = input.title.replace(/[^\p{L}]/gu, "");
  const upper = letters.replace(/[^\p{Lu}]/gu, "");
  if (letters.length >= 10 && upper.length / letters.length > 0.6) add("SHOUTING", 1);
  if (/(.)\1{5,}/u.test(raw.replace(/\s/g, ""))) add("REPEATED_CHARS", 1);

  return { score, flags, hold: score >= HOLD_THRESHOLD };
}
