// Türkçe duyarsız arama için metin katlama (spec §4.9).
// Örnek: "İSTANBUL" -> "istanbul", "Ayşe Nur" -> "ayse nur", "IŞIK" -> "isik".

const CHAR_MAP: Record<string, string> = {
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

const MAPPED_CHARS = /[çğıöşüâîûêô]/g;

/**
 * Metni arama için katlar: Türkçe küçük harf, birleşik işaretler atılır,
 * Türkçe harfler ASCII karşılığına çevrilir, [a-z0-9] dışındaki her karakter
 * boşluğa döner ve boşluklar tekilleştirilip kırpılır.
 */
export function foldTr(input: string): string {
  return input
    .normalize("NFD")
    .toLocaleLowerCase("tr-TR")
    .replace(/[̀-ͯ]/g, "")
    .replace(MAPPED_CHARS, (ch) => CHAR_MAP[ch] ?? ch)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Birden çok alanı (dize ya da dize dizisi) tek bir aranabilir metne çevirir. */
export function toSearchText(
  ...parts: Array<string | null | undefined | string[]>
): string {
  return parts
    .flat()
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .map(foldTr)
    .filter((part) => part.length > 0)
    .join(" ");
}

/** Arama sorgusunu katlanmış belirteçlere ayırır: 2 karakterden kısaları atar, en fazla 6 tane. */
export function searchTokens(query: string): string[] {
  return foldTr(query)
    .split(" ")
    .filter((token) => token.length >= 2)
    .slice(0, 6);
}
