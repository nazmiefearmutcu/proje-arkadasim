import { getDisciplineGroup, type DisciplineGroupId } from "@/config/taxonomy";
import { parseList } from "@/lib/json-fields";

export interface SuggestionUser {
  disciplineGroup: string | null;
  interestsJson: string;
  city: string | null;
}

const GUEST_SUGGESTIONS: readonly string[] = [
  "Yapay zeka projelerini ara…",
  "Mobil uygulama projesi ara…",
  "Endüstriyel tasarımcı ara…",
  "Girişim projelerini ara…",
];

const ROLE_PHRASES: Record<DisciplineGroupId, string> = {
  yazilim: "Yazılımcı ekip arkadaşı ara…",
  elektronik: "Elektronik mühendisi ara…",
  makine: "Makine mühendisi ara…",
  endustri: "Endüstri mühendisi ara…",
  mimarlik: "Mimar ara…",
  tasarim: "Endüstriyel tasarımcı ara…",
  isletme: "Pazarlama ve iş geliştirme ekip arkadaşı ara…",
  saglik: "Sağlık alanından ekip arkadaşı ara…",
  hukuk: "Hukukçu ekip arkadaşı ara…",
  sosyal: "Sosyal bilimci ekip arkadaşı ara…",
  temel: "Araştırmacı ekip arkadaşı ara…",
  sanat: "Sanatçı ve içerik üreticisi ara…",
};

// Ünlü uyumu ve sert ünsüz benzeşmesi: son sesli harf ön ise "de/te", arka ise "da/ta".
// Sert ünsüzle (ç f h k p s ş t) biten adlarda "t" ile başlar.
const BACK_VOWELS = new Set(["a", "ı", "o", "u"]);
const VOWELS = new Set(["a", "e", "ı", "i", "o", "ö", "u", "ü"]);
const VOICELESS = new Set(["ç", "f", "h", "k", "p", "s", "ş", "t"]);

/**
 * Şehir adına Türkçe bulunma eki ekler: "İzmir" -> "İzmir'deki", "Sivas" -> "Sivas'taki".
 * Ekin "ki" parçası ilgi zamirini kurar ("İzmir'deki projeleri ara…").
 */
export function locativeTr(city: string): string {
  const name = city.trim();
  const chars = Array.from(name.toLocaleLowerCase("tr-TR"));
  let lastVowel: string | undefined;
  for (let i = chars.length - 1; i >= 0; i--) {
    if (VOWELS.has(chars[i])) {
      lastVowel = chars[i];
      break;
    }
  }
  const lastChar = chars[chars.length - 1] ?? "";
  const back = lastVowel !== undefined && BACK_VOWELS.has(lastVowel);
  const suffix = (VOICELESS.has(lastChar) ? "t" : "d") + (back ? "a" : "e");
  return `${name}'${suffix}ki`;
}

/**
 * Arama kutusunun yarı saydam placeholder önerileri (spec §4.9). Misafir için genel öneriler;
 * kullanıcı için tamamlayıcı disiplinler, en fazla iki ilgi alanı ve şehir. Liste 4 ile 6 arasındadır.
 */
export function getSearchSuggestions(user: SuggestionUser | null): string[] {
  if (user === null) return [...GUEST_SUGGESTIONS];

  const suggestions: string[] = [];
  const group = user.disciplineGroup ? getDisciplineGroup(user.disciplineGroup) : undefined;

  for (const complement of group?.complements ?? []) {
    suggestions.push(ROLE_PHRASES[complement]);
  }

  for (const interest of parseList(user.interestsJson).slice(0, 2)) {
    suggestions.push(`'${interest}' projelerini ara…`);
  }

  if (user.city) {
    suggestions.push(`${locativeTr(user.city)} projeleri ara…`);
  }

  const unique = [...new Set(suggestions)];
  for (const fallback of GUEST_SUGGESTIONS) {
    if (unique.length >= 4) break;
    if (!unique.includes(fallback)) unique.push(fallback);
  }

  return unique.slice(0, 6);
}

/**
 * Öneri metnini arama sorgusuna çevirir: sondaki "ara…" ifadesi, "projelerini/projeleri/projesi"
 * sözcükleri ve tek tırnak atılır; "'robotik' projelerini ara…" -> "robotik", "İzmir'deki projeleri ara…" -> "İzmir".
 * Büyük/küçük harf korunur; arama zaten büyük/küçük harfe duyarsızdır.
 */
export function suggestionToQuery(suggestion: string): string {
  let text = suggestion.trim().replace(/(…|\.\.\.)$/, "").trim();
  text = text.replace(/\s+ara$/, "").trim();
  text = text.replace(/\s+(projelerini|projeleri|projesi)$/, "").trim();

  const quoted = /^'(.+)'$/.exec(text);
  if (quoted) return quoted[1].trim();

  const locative = /^(.+?)'[^\s']+$/.exec(text);
  if (locative) return locative[1].trim();

  return text;
}
