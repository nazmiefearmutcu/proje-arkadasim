// e-Devlet sorgusu için kullanıcı girdileri (spec 2026-11-27 §4). Saf işlevler.

/** e-Devlet formundaki barkod alanının üst sınırı (maxlength="50"). */
export const BARCODE_MAX_LENGTH = 50;
const BARCODE_MIN_LENGTH = 8;

/**
 * Barkodu sorgulanabilir biçime getirir: boşluklar atılır, harfler büyütülür. Yalnız ASCII harf, rakam
 * ve tire kabul edilir; uymayan girdi için null döner.
 */
export function normalizeBarcode(raw: string): string | null {
  // e-Devlet barkodları ASCII harf ve rakamdır. Türkçe büyütme kullanılmaz: küçük "i" "İ" olmamalı.
  const value = raw.replace(/\s+/g, "").toUpperCase();
  if (value.length < BARCODE_MIN_LENGTH || value.length > BARCODE_MAX_LENGTH) return null;
  // Rakam şartı yok: YÖK barkodları (ör. "YOKOG...") yalnız harften de oluşabilir.
  if (!/^[A-Z0-9-]+$/.test(value)) return null;
  return value;
}

/**
 * T.C. kimlik numarası doğrulaması: 11 hane, ilk hane 0 değil, 10. ve 11. hane kontrol haneleri tutar.
 * Geçerliyse rakamlardan oluşan dizeyi, değilse null döner.
 */
export function normalizeTckn(raw: string): string | null {
  const value = raw.replace(/\s+/g, "");
  if (!/^[1-9]\d{10}$/.test(value)) return null;
  const digits = value.split("").map(Number);
  const odd = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const even = digits[1] + digits[3] + digits[5] + digits[7];
  const tenth = (((odd * 7 - even) % 10) + 10) % 10;
  if (tenth !== digits[9]) return null;
  const eleventh = digits.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10;
  if (eleventh !== digits[10]) return null;
  return value;
}
