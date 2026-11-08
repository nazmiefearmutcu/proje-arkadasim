import { foldTr } from "@/lib/tr";

/** İki dize arasındaki Levenshtein (düzenleme) uzaklığı. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const current: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

/** Ad parçası eşleşmesi: tam eşleşme ya da (fuzzy ve ≥ 4 harfte) Levenshtein ≤ 1. */
function tokenMatches(token: string, name: string, fuzzy: boolean): boolean {
  if (token === name) return true;
  return fuzzy && token.length >= 4 && name.length >= 4 && levenshtein(token, name) <= 1;
}

/**
 * Metinde kayıtlı adın eşleşip eşleşmediğini söyler (spec §5.1 adım 4).
 * Soyadın bütün parçaları ve adın en az bir parçası bulunmalıdır. Karşılaştırma
 * Türkçe katlanmış (foldTr) biçimde yapılır. `fuzzy` açıkken ≥ 4 harfli parçalarda
 * Levenshtein ≤ 1 tolerans tanınır (OCR gürültüsü için).
 */
export function matchName(
  text: string,
  firstName: string,
  lastName: string,
  opts: { fuzzy: boolean },
): boolean {
  const textTokens = foldTr(text).split(" ").filter((token) => token.length > 0);
  const firstTokens = foldTr(firstName).split(" ").filter((token) => token.length > 0);
  const lastTokens = foldTr(lastName).split(" ").filter((token) => token.length > 0);
  if (firstTokens.length === 0 || lastTokens.length === 0) return false;

  const found = (name: string) =>
    textTokens.some((token) => tokenMatches(token, name, opts.fuzzy));

  const lastNameFound = lastTokens.every(found);
  const firstNameFound = firstTokens.some(found);
  return lastNameFound && firstNameFound;
}
