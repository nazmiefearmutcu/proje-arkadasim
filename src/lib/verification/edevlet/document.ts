import { disciplineGroupForDepartment } from "@/config/taxonomy";
import type { DegreeLevel } from "@/config/taxonomy";
import { CLASS_YEAR_MAX, GRADUATION_YEAR_MIN } from "@/lib/settings/limits";
import { foldTr } from "@/lib/tr";
import type { EducationProfile } from "../decision";

// e-Devlet'in doğruladığı belgenin metninden eğitim bilgilerini okur (spec 2026-11-27 §4). Metin
// e-Devlet'in kendi sonucudur (sonuç sayfası ya da belgenin PDF'i); kullanıcının yüklediği dosya değildir.
// Saf işlevdir. Okuyamadığı alanı null bırakır; karar servis katmanındadır (eksikse editöre gider).

export type DocumentKind = "STUDENT_CERT" | "GRADUATE_CERT" | "SCHOOL" | "OTHER";
export type EnrollmentStatus = "STUDENT" | "GRADUATE" | "INACTIVE";

export interface EDevletDocument {
  kind: DocumentKind;
  status: EnrollmentStatus | null;
  university: string | null;
  faculty: string | null;
  department: string | null;
  degreeLevel: DegreeLevel | null;
  classYear: number | null;
  graduationYear: number | null;
  issueDate: Date | null;
}

type FieldKey = "university" | "faculty" | "department" | "classYear" | "status" | "level" | "issueDate" | "graduationDate";

// Katlanmış (foldTr) etiketler. Daha uzun etiket önce denenir.
const LABELS: Record<FieldKey, string[]> = {
  university: ["yuksekogretim kurumu", "universite adi", "universitesi", "universite", "kurum adi"],
  faculty: ["fakulte yuksekokul myo", "fakulte yuksekokul", "fakulte enstitu", "fakulte adi", "fakulte", "birim", "enstitu"],
  department: ["bolum program", "program adi", "bolum adi", "anabilim dali", "programi", "program", "bolumu", "bolum"],
  classYear: ["sinifi", "sinif"],
  status: ["ogrencilik durumu", "ogrenci durumu", "kayit durumu", "durumu"],
  level: ["ogrenim duzeyi", "egitim duzeyi", "ogrenim seviyesi", "duzeyi", "derece"],
  issueDate: ["belgenin olusturulma tarihi", "olusturulma tarihi", "duzenlenme tarihi", "belge tarihi"],
  graduationDate: ["mezuniyet tarihi"],
};

const SMALL_WORDS = new Set(["ve", "ile", "veya"]);

/** Büyük harfle yazılmış değeri Türkçe başlık biçimine çevirir: "BİLGİSAYAR MÜHENDİSLİĞİ" → "Bilgisayar Mühendisliği". */
export function titleCaseTr(value: string): string {
  const clean = value.replace(/\s+/g, " ").replace(/^[\s:.\-–]+|[\s:.\-–]+$/g, "").slice(0, 150);
  const letters = clean.replace(/[^\p{L}]/gu, "");
  const upper = letters.replace(/[^\p{Lu}]/gu, "");
  if (letters.length === 0 || upper.length / letters.length < 0.7) return clean;
  return clean
    .toLocaleLowerCase("tr-TR")
    .split(" ")
    .map((word, index) => {
      if (index > 0 && SMALL_WORDS.has(word)) return word;
      const at = word.search(/\p{L}/u);
      if (at < 0) return word;
      return word.slice(0, at) + word.charAt(at).toLocaleUpperCase("tr-TR") + word.slice(at + 1);
    })
    .join(" ");
}

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0);
}

/**
 * Etiket-değer çiftini bulur. Üç biçim denenir: "Etiket: Değer" aynı satırda; etiket tek başına bir
 * satırda ve değer sonraki satırda (tablo hücreleri); "Etiket Değer" aynı satırda (iki nokta yok).
 */
function findLabeled(all: string[], key: FieldKey): string | null {
  const labels = LABELS[key];
  for (let i = 0; i < all.length; i += 1) {
    const line = all[i];
    const colon = line.indexOf(":");
    if (colon > 0) {
      const head = foldTr(line.slice(0, colon));
      if (labels.includes(head)) {
        const value = line.slice(colon + 1).trim();
        if (value.length > 0) return value;
        if (all[i + 1]) return all[i + 1];
      }
      continue;
    }
    const folded = foldTr(line);
    if (labels.includes(folded)) {
      const next = all[i + 1];
      if (next && !isLabelLine(next)) return next;
      continue;
    }
    for (const label of labels) {
      if (folded.startsWith(`${label} `) && label.split(" ").length >= 1) {
        // Ham satırda etiketin kapladığı kelime sayısı kadar kelimeyi at.
        const words = line.split(" ");
        const count = label.split(" ").length;
        const headWords = foldTr(words.slice(0, count).join(" "));
        if (headWords === label) {
          const value = words.slice(count).join(" ").trim();
          if (value.length > 0) return value;
        }
      }
    }
  }
  return null;
}

function isLabelLine(line: string): boolean {
  const folded = foldTr(line.split(":")[0]);
  return Object.values(LABELS).some((labels) => labels.includes(folded));
}

/**
 * Etiketsiz belgelerde üniversite adı: kendi satırında duran ve "Üniversitesi" ya da "Enstitüsü" ile
 * biten kısa satır. Cümle içindeki ifadeler alınmaz (önündeki kişi adı da kurum adına karışabilir).
 */
function universityLine(all: string[]): string | null {
  for (const line of all) {
    const folded = foldTr(line);
    if (!/(?:universitesi|enstitusu)$/.test(folded)) continue;
    const words = stripLeadingLabels(line.replace(/^[^:]*:\s*/, "")).split(" ");
    if (words.length >= 2 && words.length <= 7) return words.join(" ");
  }
  return null;
}

const LEADING_LABEL_WORDS = new Set(["universite", "universitesi", "adi", "kurum", "kurumu", "yuksekogretim"]);

function stripLeadingLabels(value: string): string {
  const words = value.split(" ");
  while (words.length > 1 && LEADING_LABEL_WORDS.has(foldTr(words[0]))) words.shift();
  return words.join(" ");
}

/**
 * YÖK öğrenci belgesindeki birleşik program satırı: "Program ÜNİVERSİTE/FAKÜLTE/BÖLÜM BÖLÜMÜ/PROGRAM PR./".
 * PDF metninde satır bölünebilir; eğik çizgili devam satırları birleştirilir. Parçaları döner.
 */
function programPath(all: string[]): string[] | null {
  for (let i = 0; i < all.length; i += 1) {
    const line = all[i];
    if (!line.includes("/")) continue;
    const first = line.split(" ")[0];
    const head = foldTr(first.replace(/:$/, ""));
    if (head !== "program" && head !== "programi") continue;
    let value = line.slice(first.length).replace(/^\s*:\s*/, "").trim();
    for (let j = i + 1; j <= i + 2 && all[j] && all[j].includes("/") && !all[j].includes(":"); j += 1) {
      value += (value.endsWith("/") ? "" : " ") + all[j];
    }
    const parts = value.split("/").map((part) => part.trim()).filter((part) => part.length > 0);
    if (parts.length >= 2) return parts;
  }
  return null;
}

interface PathFields {
  university: string | null;
  faculty: string | null;
  department: string | null;
}

function fieldsFromPath(parts: string[]): PathFields {
  const result: PathFields = { university: null, faculty: null, department: null };
  let program: string | null = null;
  for (const part of parts) {
    const folded = foldTr(part);
    if (!result.university && /universitesi\b|universitesi$/.test(folded)) result.university = part;
    else if (!result.faculty && /fakultesi|yuksekokulu|enstitusu|konservatuvari/.test(folded)) result.faculty = part;
    else if (!result.department && /\bbolumu$|\banabilim dali$/.test(folded)) {
      result.department = part.replace(/\s+(?:BÖLÜMÜ|Bölümü|bölümü)$/u, "").trim();
    } else if (!program && /\bpr$|\bprogrami$/.test(folded)) {
      program = part.replace(/\s+(?:PR\.?|PROGRAMI|Programı)$/u, "").trim();
    }
  }
  if (!result.department && program) result.department = program;
  return result;
}

/** Etiketsiz tarihler: kendi satırında duran tarihlerin bugünü geçmeyen en yenisi (belge tarihi en yenisidir). */
function latestStandaloneDate(all: string[], now: Date): Date | null {
  let latest: Date | null = null;
  for (const line of all) {
    if (!/^\d{1,2}[./-]\d{1,2}[./-]\d{4}$/.test(line)) continue;
    const date = parseDate(line);
    if (!date || date.getTime() > now.getTime() + 24 * 60 * 60 * 1000) continue;
    if (!latest || date > latest) latest = date;
  }
  return latest;
}

/** "ÖRGÜN ÖĞRETİM / 4" gibi öğrenim süresinden düzey (yalnız güvenli olduğunda). */
function levelFromDuration(folded: string): DegreeLevel | null {
  const match = folded.match(/\b(?:orgun|ikinci|uzaktan|acik) ogretim ([1-7])\b/);
  if (!match) return null;
  const years = Number(match[1]);
  // Lisansüstü programların da süresi 2 olabilir; enstitü geçen belgede süreden düzey çıkarılmaz.
  if (/\benstitusu\b/.test(folded)) return null;
  if (years === 2 && /meslek yuksekokulu|\bmyo\b/.test(folded)) return "ONLISANS";
  if (years >= 4 && years <= 6) return "LISANS";
  return null;
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const match = value.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function levelFrom(folded: string): DegreeLevel | null {
  if (/\bdoktora\b/.test(folded)) return "DOKTORA";
  if (/\byuksek lisans\b|\btezli\b|\btezsiz\b/.test(folded)) return "YUKSEK_LISANS";
  if (/\bon lisans\b|\bonlisans\b|\bmeslek yuksekokulu\b/.test(folded)) return "ONLISANS";
  if (/\blisans\b/.test(folded)) return "LISANS";
  return null;
}

function statusFrom(folded: string): EnrollmentStatus | null {
  if (/kaydi silin|iliski kesil|iligi kesil|iliskisi kesil|kaydini sildir|kayit sildir|ayrilmistir/.test(folded)) return "INACTIVE";
  if (/\bmezun\b|mezuniyet/.test(folded)) return "GRADUATE";
  if (/aktif|kayitli|devam|ogrencisidir|ogrenci/.test(folded)) return "STUDENT";
  return null;
}

export function parseEDevletDocument(text: string, now: Date = new Date()): EDevletDocument {
  const all = lines(text);
  const folded = foldTr(text);
  const path = programPath(all);
  const fromPath = path ? fieldsFromPath(path) : null;

  // Belge türü.
  let kind: DocumentKind = "OTHER";
  const university = (() => {
    const labeled = findLabeled(all, "university");
    if (labeled && /universite|enstitu/.test(foldTr(labeled))) return labeled;
    return fromPath?.university ?? universityLine(all);
  })();
  if (/mezun belgesi|mezuniyet belgesi|\bdiploma\b/.test(folded)) kind = "GRADUATE_CERT";
  else if (/ogrenci belgesi|ogrencilik belgesi/.test(folded)) kind = "STUDENT_CERT";
  if (kind !== "OTHER" && !university && /milli egitim bakanligi/.test(folded)) kind = "SCHOOL";

  // Öğrencilik durumu: önce etiketli değer, sonra tüm metin.
  const statusValue = findLabeled(all, "status");
  let status = statusValue ? statusFrom(foldTr(statusValue)) : null;
  if (!status || status === "STUDENT") {
    const whole = statusFrom(folded);
    if (whole === "INACTIVE") status = "INACTIVE";
    else if (!status) status = whole;
  }
  if (kind === "GRADUATE_CERT" && status !== "INACTIVE") status = "GRADUATE";

  const levelValue = findLabeled(all, "level");
  const degreeLevel = (levelValue ? levelFrom(foldTr(levelValue)) : null) ?? levelFrom(folded) ?? levelFromDuration(folded);

  const classValue = findLabeled(all, "classYear");
  const classMatch = classValue?.match(/\b([1-9])\b/) ?? folded.match(/\b([1-9]) sinif\b/);
  const classYear = classMatch ? Number(classMatch[1]) : null;

  const graduationDate = parseDate(findLabeled(all, "graduationDate"));
  const issueDate = parseDate(findLabeled(all, "issueDate")) ?? latestStandaloneDate(all, now);

  // Birleşik program satırı varsa fakülte ve bölüm oradan okunur (etiketli değer o satırın kendisidir).
  const faculty = findLabeled(all, "faculty") ?? fromPath?.faculty ?? null;
  const labeledDepartment = findLabeled(all, "department");
  const department = fromPath && (!labeledDepartment || labeledDepartment.includes("/")) ? fromPath.department : labeledDepartment;

  return {
    kind,
    status,
    university: university ? titleCaseTr(university) : null,
    faculty: faculty ? titleCaseTr(faculty) : null,
    department: department ? titleCaseTr(department) : null,
    degreeLevel,
    classYear: classYear !== null && classYear >= 1 && classYear <= CLASS_YEAR_MAX ? classYear : null,
    graduationYear: graduationDate ? graduationDate.getUTCFullYear() : null,
    issueDate,
  };
}

/** Okunan belgeyi profile yazılacak eğitim alanlarına çevirir. */
export function profileFromDocument(doc: EDevletDocument, now: Date = new Date()): EducationProfile {
  const graduationYear =
    doc.graduationYear !== null && doc.graduationYear >= GRADUATION_YEAR_MIN && doc.graduationYear <= now.getUTCFullYear() + 1
      ? doc.graduationYear
      : null;
  return {
    university: doc.university,
    faculty: doc.faculty,
    department: doc.department,
    academicStatus: doc.status === "GRADUATE" ? "GRADUATE" : doc.status === "STUDENT" ? "STUDENT" : null,
    degreeLevel: doc.degreeLevel,
    classYear: doc.status === "STUDENT" ? doc.classYear : null,
    graduationYear: doc.status === "GRADUATE" ? graduationYear : null,
    disciplineGroup: disciplineGroupForDepartment(doc.department),
  };
}
