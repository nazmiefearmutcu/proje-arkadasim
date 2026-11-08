const MAX_ITEM_LENGTH = 40;

/**
 * Tekilleştirme anahtarı: sembolleri (C# / C++ / .NET) korur, yalnız büyük/küçük harf
 * ve boşluk farkını siler. foldTr burada kullanılmaz; sembolleri atıp farklı etiketleri
 * birbirine karıştırır. Türkçe küçük harf çevirisi ASCII "I" harfini "ı" yapar; bu yüzden
 * "ı" ayrıca "i" sayılır, böylece "AI" ile "ai", "ROBOTIK" ile "Robotik" aynı anahtarı alır.
 * İstemcideki etiket girişi de aynı anahtarı kullanır.
 */
export function dedupeKey(item: string): string {
  return item.normalize("NFC").replace(/\s+/g, " ").toLocaleLowerCase("tr-TR").replace(/ı/g, "i");
}

/** JSON metninden metin listesi okur. Hata vermez; dizi değilse boş liste döner. */
export function parseList(json: string | null | undefined): string[] {
  if (typeof json !== "string" || json.length === 0) return [];
  try {
    const value: unknown = JSON.parse(json);
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

/**
 * Listeyi saklamaya uygun JSON metne çevirir: kırpar, boşları atar, büyük/küçük harf
 * ve Türkçe harf farkı gözetmeksizin tekilleştirir, her öğeyi 40 karakterle sınırlar
 * ve en fazla `max` öğe bırakır.
 */
export function toListJson(list: readonly string[], max = 20): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    if (out.length >= max) break;
    const item = raw.trim().slice(0, MAX_ITEM_LENGTH).trim();
    if (item.length === 0) continue;
    const key = dedupeKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return JSON.stringify(out);
}

/** JSON metninden nesne okur. Hata verir ya da nesne değilse `fallback` döner. */
export function parseObject<T>(json: string | null | undefined, fallback: T): T {
  if (typeof json !== "string" || json.length === 0) return fallback;
  try {
    const value: unknown = JSON.parse(json);
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as T;
    }
    return fallback;
  } catch {
    return fallback;
  }
}
