import { foldTr } from "@/lib/tr";
import { levenshtein } from "./name-match";

// Yurt dışına (yapay zeka sağlayıcısına) gönderilmeden önce belge metnini maskeler (spec §5.1 adım 5).
// Uygulanan sıra: TCKN → etiketli değerler → "Adı Soyadı" → ad/soyad parçaları → e-posta/telefon/IBAN
// → kalan uzun sayılar → kırpma ve boşluk düzeni.

const MAX_MASKED_CHARS = 6000;

// Çıktıya girmeden önce maske etiketleri, yerine özel kullanım (PUA) karakterlerinden oluşan
// bir kodla konur. Bu kodlar harf ya da rakam değildir; böylece sonraki kurallar (ad eşleşmesi,
// sayı kuralı) maske etiketlerini yeniden işlemez. En sonda geri çevrilir.
const SENTINEL_START = "\uE000";
const SENTINEL_END = "\uE001";
const DIGIT_BASE = 0xe100; // U+E100..U+E109 = 0..9
const SENTINEL_CODE = new RegExp(`${SENTINEL_START}([\\uE100-\\uE109]+)${SENTINEL_END}`, "g");
const SENTINEL_ONLY = new RegExp(`^${SENTINEL_START}[\\uE100-\\uE109]+${SENTINEL_END}$`);

// Tek karakterlik, uzunluğu koruyan Türkçe katlama. Etiket eşleşmesi indeksleri kaydırmamalı.
const LETTER_MAP: Record<string, string> = {
  ç: "c",
  ğ: "g",
  ı: "i",
  ö: "o",
  ş: "s",
  ü: "u",
  â: "a",
  î: "i",
  û: "u",
  ê: "e",
  ô: "o",
};

const MASK_KEYS = ["TCKN", "ETIKET", "AD_SOYAD", "AD", "SOYAD", "ILETISIM", "NUMARA"] as const;
export type MaskKind = (typeof MASK_KEYS)[number];

const SPACE = "[ \\t]+";

// Etiketler katlanmış (küçük harf, Türkçe harfsiz) biçimde yazılır. Düzenli ifadeler
// katlanmış metin üzerinde çalışır, dolayısıyla "Doğum" ile "DOGUM" aynı şekilde eşleşir.
// Aynı noktada başlayan etiketlerden en uzunu kazanır (keptLabelHits); yine de okunurluk için
// uzun biçimler önce yazılır. İyelik biçimleri ("Adresi", "Telefonu", "Numarası") ve önündeki
// nitelemeler ("İkamet Adresi", "Cep Telefonu") de etiket sayılır: etiket, değerin başladığı
// yerde biter.
const OPT_SPACE = "[ \\t]*";

const VALUE_LABEL_SOURCES = [
  `\\(?t\\.?${OPT_SPACE}c\\.?\\)?${OPT_SPACE}kimlik${SPACE}(?:numarasi|no)`,
  `kimlik${SPACE}(?:numarasi|no)`,
  `belge${SPACE}dogrulama${SPACE}kodu`,
  `dogrulama${SPACE}kodu`,
  `dogum${SPACE}yeri${OPT_SPACE}/${OPT_SPACE}tarihi`,
  `dogum${SPACE}yeri`,
  `dogum${SPACE}tarihi`,
  `ogrenci${SPACE}(?:numarasi|no)`,
  `baba${SPACE}adi`,
  `anne${SPACE}adi`,
  `ana${SPACE}adi`,
  `seri${SPACE}(?:numarasi|no)`,
  `barkod${SPACE}(?:numarasi|no)`,
  "barkod",
  `e${OPT_SPACE}-?${OPT_SPACE}posta(?:${SPACE}adresi)?`,
  `telefon(?:${SPACE}(?:numarasi|no)|u)?`,
  "adres(?:i)?",
  "uyrugu",
  "uyruk",
];

// Ad/soyad etiketleri. "Adı Soyadı" ve "Ad Soyad" (araya "/" ya da "-" girse de) her yerde etikettir.
const NAME_LABEL_SOURCES = [
  `adi${OPT_SPACE}[-/]?${OPT_SPACE}soyadi`,
  `ad${OPT_SPACE}[-/]?${OPT_SPACE}soyad`,
];

// Satır başına bağlı etiketler: yalnız satırın ilk sözcüğü olup ardından ":" geldiğinde etikettir.
// Böylece "Program Adı : X", "Üniversite Adı : X" ya da "Adı geçen öğrenci" maskelenmez;
// kayıtlı ad başka yerlerde kural 4 ile yine maskelenir. Katlanmış metin satır sonlarını korur
// (foldKeepingLength karakter karakter çalışır), "m" bayrağıyla "^" her satır başında eşleşir.
const LINE_START = `(?<=^${OPT_SPACE})`;
const BEFORE_COLON = `(?=${OPT_SPACE}:)`;
const LINE_VALUE_LABEL_SOURCES = [`${LINE_START}kimlik${BEFORE_COLON}`];
const LINE_NAME_LABEL_SOURCES = [
  `${LINE_START}(?:soyadi|adi)${BEFORE_COLON}`,
  // "Soyadı :" satır ortasında da (ör. "Anne Kızlık Soyadı :") yalnız bir ad etiketidir.
  `soyadi${BEFORE_COLON}`,
];

type LabelKind = "ETIKET" | "AD_SOYAD";

interface LabelPattern {
  kind: LabelKind;
  regex: RegExp;
}

function buildLabelPatterns(): LabelPattern[] {
  const compile = (sources: string[], kind: LabelKind, flags: string): LabelPattern[] =>
    sources.map((source) => ({
      kind,
      regex: new RegExp(`(?<![a-z])(?:${source})(?![a-z])`, flags),
    }));
  return [
    ...compile(VALUE_LABEL_SOURCES, "ETIKET", "g"),
    ...compile(LINE_VALUE_LABEL_SOURCES, "ETIKET", "gm"),
    ...compile(NAME_LABEL_SOURCES, "AD_SOYAD", "g"),
    ...compile(LINE_NAME_LABEL_SOURCES, "AD_SOYAD", "gm"),
  ];
}

const LABEL_PATTERNS = buildLabelPatterns();

// Kural 1: 11 haneli sayılar. Haneler arasında en fazla 3 karakterlik boşluk/sekme/nokta/tire
// olabilir (OCR'daki çift boşluk ya da " - " gibi). Tarih aralıkları (gg.aa.yyyy - gg.aa.yyyy)
// 11 haneli bir öbek oluşturmaz, korunur.
const TCKN_RE = /(?<!\d)\d(?:[ \t.\-]{0,3}\d){10}(?!\d)/g;
// Kural 5: IBAN (TR + 24 hane, boşluklu olabilir), e-posta, Türkiye telefonu.
const IBAN_RE = /(?<![\p{L}\d])TR(?:[ ]?\d){24}(?!\d)/giu;
const EMAIL_RE = /[\p{L}\p{N}._%+\-\uE000\uE001\uE100-\uE109]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu;
const PHONE_RE = /(?:\+[ ]?90|(?<!\d)0)(?:[ ()-]*\d){10}/g;
// Kural 6: kalan 6 ve üzeri haneli sayılar. Yıllar (4 hane) ve gg.aa.yyyy tarihleri korunur.
const LONG_NUMBER_RE = /\d{6,}/g;
// Kural 4: ad ve soyad sözcükleri. matchName ile aynı belirteç ayrımı: harf ve rakamlar birlikte
// ("K1LIÇ" tek belirteçtir). Kod karakterleri (PUA) harf ya da rakam değildir, sınıfa girmez.
const WORD_RE = /[\p{L}\p{N}]+/gu;
const DIGITS_ONLY = /^\p{N}+$/u;

interface Hit {
  start: number;
  end: number;
  kind: LabelKind;
}

interface Replacement {
  start: number;
  end: number;
  label: string;
  kind: MaskKind;
}

/** Katlanmış metin: yalnız küçük harf ve Türkçe harf eşlemesi; uzunluk değişmez. */
function foldKeepingLength(text: string): string {
  let out = "";
  for (const ch of text) {
    const lower = ch.toLocaleLowerCase("tr-TR");
    const base = lower.length === 1 ? lower : ch;
    out += LETTER_MAP[base] ?? base;
  }
  return out;
}

function encodeIndex(index: number): string {
  return [...String(index)].map((digit) => String.fromCharCode(DIGIT_BASE + Number(digit))).join("");
}

function decodeIndex(encoded: string): number {
  return Number(
    [...encoded].map((ch) => String(ch.charCodeAt(0) - DIGIT_BASE)).join(""),
  );
}

/** Maske etiketini kaydedip yerine özel kullanım kodu koyar. */
function protect(masks: string[], label: string): string {
  masks.push(label);
  return `${SENTINEL_START}${encodeIndex(masks.length - 1)}${SENTINEL_END}`;
}

/** Etiket aralıklarını bulur; birbiriyle çakışanlardan en erken ve en uzun olanı tutar. */
function keptLabelHits(folded: string): Hit[] {
  const hits: Hit[] = [];
  for (const { kind, regex } of LABEL_PATTERNS) {
    regex.lastIndex = 0;
    for (const match of folded.matchAll(regex)) {
      const start = match.index ?? 0;
      hits.push({ start, end: start + match[0].length, kind });
    }
  }
  hits.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));

  const kept: Hit[] = [];
  let cursor = -1;
  for (const hit of hits) {
    if (hit.start >= cursor) {
      kept.push(hit);
      cursor = hit.end;
    }
  }
  return kept;
}

/**
 * Etiketli değerleri bulur: etiketten sonra gelen (iki nokta üst üste isteğe bağlı) değer,
 * satır sonuna ya da bir sonraki bilinen etikete kadar sürer.
 */
function labelReplacements(work: string): Replacement[] {
  const folded = foldKeepingLength(work);
  const kept = keptLabelHits(folded);
  const separator = /[ \t]*:?[ \t]*/y;
  const replacements: Replacement[] = [];

  kept.forEach((hit, index) => {
    separator.lastIndex = hit.end;
    separator.exec(folded);
    const valueStart = separator.lastIndex;

    let valueEnd = folded.indexOf("\n", valueStart);
    if (valueEnd === -1) valueEnd = folded.length;
    const next = kept[index + 1];
    if (next && next.start >= valueStart && next.start < valueEnd) valueEnd = next.start;
    while (valueEnd > valueStart && /[ \t\r]/.test(work[valueEnd - 1])) valueEnd--;
    if (valueEnd <= valueStart) return;

    // Değer zaten bir maske kodu ise (ör. TCKN) etiket korunur, değer olduğu gibi kalır.
    if (SENTINEL_ONLY.test(work.slice(valueStart, valueEnd))) return;

    replacements.push({
      start: valueStart,
      end: valueEnd,
      label: hit.kind === "AD_SOYAD" ? "[AD SOYAD]" : "[GİZLİ]",
      kind: hit.kind === "AD_SOYAD" ? "AD_SOYAD" : "ETIKET",
    });
  });
  return replacements;
}

function applyReplacements(
  work: string,
  replacements: Replacement[],
  masks: string[],
  counts: Record<MaskKind, number>,
): string {
  let result = work;
  for (const replacement of [...replacements].sort((a, b) => b.start - a.start)) {
    counts[replacement.kind] += 1;
    result =
      result.slice(0, replacement.start) +
      protect(masks, replacement.label) +
      result.slice(replacement.end);
  }
  return result;
}

function matchesNameToken(token: string, names: string[]): boolean {
  return names.some(
    (name) =>
      token === name ||
      (token.length >= 4 && name.length >= 4 && levenshtein(token, name) <= 1),
  );
}

function normalizeOutput(text: string): string {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\u00a0]+/g, " ").trim());
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Belge metnini kişisel verilerden arındırır. Saf fonksiyondur: dış durum okumaz.
 * `counts` her maske türünden kaç uygulama yapıldığını söyler; değerleri asla içermez.
 */
export function maskDocumentText(
  text: string,
  person: { firstName: string; lastName: string },
): { masked: string; counts: Record<MaskKind, number> } {
  const counts = Object.fromEntries(MASK_KEYS.map((key) => [key, 0])) as Record<MaskKind, number>;
  const masks: string[] = [];

  // Kod karakterlerinin girdide yer almasını engelle, metni NFC biçimine getir (PDF'lerde
  // "Ğ" gibi harfler birleşik biçimde gelebilir).
  let work = text
    .normalize("NFC")
    .replace(/[\uE000\uE001\uE100-\uE109]/g, " ");

  // Kural 1: TCKN (sağlama algoritmasından bağımsız, bütün 11 haneli sayılar).
  work = work.replace(TCKN_RE, () => {
    counts.TCKN += 1;
    return protect(masks, "[TCKN]");
  });

  // Kural 2 ve 3: etiketli değerler (ad/soyad etiketleri dahil).
  work = applyReplacements(work, labelReplacements(work), masks, counts);

  // Kural 4: ad ve soyad parçaları (OCR gürültüsü için ≥ 4 karakterde Levenshtein ≤ 1).
  // Yalnız rakamdan oluşan belirteçler (yıllar, numaralar) atlanır.
  const firstTokens = foldTr(person.firstName).split(" ").filter((token) => token.length > 0);
  const lastTokens = foldTr(person.lastName).split(" ").filter((token) => token.length > 0);
  work = work.replace(WORD_RE, (word) => {
    if (DIGITS_ONLY.test(word)) return word;
    const token = foldTr(word);
    if (token.length === 0) return word;
    if (matchesNameToken(token, firstTokens)) {
      counts.AD += 1;
      return protect(masks, "[AD]");
    }
    if (matchesNameToken(token, lastTokens)) {
      counts.SOYAD += 1;
      return protect(masks, "[SOYAD]");
    }
    return word;
  });

  // Kural 5: IBAN, e-posta, telefon. IBAN önce: içindeki "0" telefon kuralına takılmasın.
  work = work.replace(IBAN_RE, () => {
    counts.ILETISIM += 1;
    return protect(masks, "[GİZLİ]");
  });
  work = work.replace(EMAIL_RE, () => {
    counts.ILETISIM += 1;
    return protect(masks, "[GİZLİ]");
  });
  work = work.replace(PHONE_RE, () => {
    counts.ILETISIM += 1;
    return protect(masks, "[GİZLİ]");
  });

  // Kural 6: kalan uzun sayılar.
  work = work.replace(LONG_NUMBER_RE, () => {
    counts.NUMARA += 1;
    return protect(masks, "[NUMARA]");
  });

  // Kural 7: kod karakterlerini gerçek maske etiketlerine çevir, boşlukları düzenle, sınırla.
  const restored = work.replace(SENTINEL_CODE, (_match, encoded: string) => {
    return masks[decodeIndex(encoded)] ?? "";
  });
  const masked = normalizeOutput(restored).slice(0, MAX_MASKED_CHARS);

  return { masked, counts };
}
