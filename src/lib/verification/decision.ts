import { disciplineGroupForDepartment } from "@/config/taxonomy";
import type { AcademicStatus, DegreeLevel, DisciplineGroupId } from "@/config/taxonomy";
import { CLASS_YEAR_MAX, GRADUATION_YEAR_MIN } from "@/lib/settings/limits";
import type { AiAnalysis } from "./providers/types";

// Karar motoru (spec §5.1 adım 7). Saf fonksiyonlar; kuralların sırası önemlidir.

export type DecisionStatus = "APPROVED" | "REJECTED" | "MANUAL_REVIEW";

export interface Decision {
  status: DecisionStatus;
  reason: string | null;
}

export interface DecisionInput {
  analysis: AiAnalysis | null;
  aiError: boolean;
  nameMatch: boolean;
  source: "PDF_TEXT" | "OCR";
  docHashUsedByOtherVerifiedUser: boolean;
  today: Date;
}

export const REASON_REUSED = "Bu belge başka bir hesabın doğrulamasında kullanılmış.";
export const REASON_REVIEW = "Belgen ekibimiz tarafından incelenecek. Sonucu en geç 24 saat içinde bildireceğiz.";
export const REASON_NOT_EDUCATION =
  "Yüklediğin dosya öğrenci belgesi veya mezun belgesi gibi görünmüyor. e-Devlet'ten aldığın belgeyi yükle.";
export const REASON_NAME_MISMATCH =
  "Belgedeki ad ve soyad hesabındaki adla eşleşmedi. Adını belgendeki gibi düzeltip tekrar dene.";
export const REASON_STUDENT_TOO_OLD =
  "Öğrenci belgen 6 aydan eski. e-Devlet'ten güncel tarihli bir belge al ve tekrar yükle.";
export const REASON_UNVERIFIED = "Belgen doğrulanamadı. Daha net bir kopya veya e-Devlet PDF'i yükle.";

/** Öğrenci belgesinin en fazla yaşı (gün). 6 ay ≈ 183 gün. */
export const STUDENT_CERTIFICATE_MAX_AGE_DAYS = 183;

const DAY_MS = 24 * 60 * 60 * 1000;

const review = (): Decision => ({ status: "MANUAL_REVIEW", reason: REASON_REVIEW });
const reject = (reason: string): Decision => ({ status: "REJECTED", reason });

/** `issueDate` (YYYY-MM-DD) ile bugün arasındaki gün farkı (UTC günleri üzerinden). */
function ageInDays(issueDate: string, today: Date): number {
  const [year, month, day] = issueDate.split("-").map(Number);
  const issued = Date.UTC(year, month - 1, day);
  const now = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return (now - issued) / DAY_MS;
}

/** Belgenin hangi karar sonucuna gittiğini belirler. Sıra: tekrar, AI, belge türü, ad, kurum, tarih, güven. */
export function decide(input: DecisionInput): Decision {
  const { analysis, aiError, nameMatch, source, docHashUsedByOtherVerifiedUser, today } = input;

  // 1. Aynı belge başka bir doğrulanmış hesapta onaylanmış.
  if (docHashUsedByOtherVerifiedUser) return reject(REASON_REUSED);

  // 2. AI çağrılamadı, rıza yok, yanıt geçersiz: hata durumunda asla otomatik onay yok.
  if (aiError || analysis === null) return review();

  // 3. Öğrenci veya mezun belgesi değil.
  if (!analysis.isEducationDocument || analysis.documentType === "DIGER") {
    return reject(REASON_NOT_EDUCATION);
  }

  // 4. Ad soyad eşleşmedi. PDF metninde kesin ret; OCR'da insan incelemesi (okuma hatası olabilir).
  if (!nameMatch) {
    return source === "PDF_TEXT" ? reject(REASON_NAME_MISMATCH) : review();
  }

  // 5. Yabancı kurum: yurt dışında okumuş Türkiye'deki mezun olabilir; karar insana bırakılır.
  if (!analysis.isTurkishHigherEducation) return review();

  // 6. Öğrenci belgesi güncel olmalı.
  if (analysis.documentType === "OGRENCI_BELGESI") {
    if (analysis.issueDate === null) return review();
    if (ageInDays(analysis.issueDate, today) > STUDENT_CERTIFICATE_MAX_AGE_DAYS) {
      return reject(REASON_STUDENT_TOO_OLD);
    }
  }

  // 7. Güven puanına göre. Bayrak varsa otomatik onay yok.
  const hasRedFlags = analysis.redFlags.length > 0;
  if (analysis.confidence < 0.5) return reject(REASON_UNVERIFIED);
  if (analysis.confidence >= 0.85 && !hasRedFlags) return { status: "APPROVED", reason: null };
  return review();
}

export interface EducationProfile {
  university: string | null;
  faculty: string | null;
  department: string | null;
  academicStatus: AcademicStatus | null;
  degreeLevel: DegreeLevel | null;
  classYear: number | null;
  graduationYear: number | null;
  disciplineGroup: DisciplineGroupId | null;
}

/** Değer [min, max] aralığında bir tam sayıysa onu, değilse null döndürür. */
function intInRange(value: number | null, min: number, max: number): number | null {
  return value !== null && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

/**
 * AI analizinden profile yazılacak eğitim alanlarını çıkarır. Sınıf ve mezuniyet yılı, ayarlar
 * formunun kabul ettiği aralığın dışındaysa yazılmaz (null); yoksa kullanıcı profilini kaydedemez.
 */
export function profileFromAnalysis(analysis: AiAnalysis, now: Date = new Date()): EducationProfile {
  const department = analysis.department;

  let academicStatus: AcademicStatus | null = null;
  if (analysis.documentType === "MEZUN_BELGESI" || analysis.documentType === "DIPLOMA") {
    academicStatus = "GRADUATE";
  } else if (analysis.academicStatus === "STUDENT" || analysis.documentType === "OGRENCI_BELGESI") {
    academicStatus = "STUDENT";
  } else if (analysis.academicStatus === "GRADUATE") {
    academicStatus = "GRADUATE";
  }

  return {
    university: analysis.institution,
    faculty: analysis.faculty,
    department,
    academicStatus,
    degreeLevel: analysis.degreeLevel === "UNKNOWN" ? null : analysis.degreeLevel,
    classYear: intInRange(analysis.classYear, 1, CLASS_YEAR_MAX),
    graduationYear: intInRange(analysis.graduationYear, GRADUATION_YEAR_MIN, now.getFullYear() + 1),
    disciplineGroup: disciplineGroupForDepartment(department),
  };
}
