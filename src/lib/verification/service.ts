import { createHmac } from "node:crypto";
import { MASKED_TEXT_RETENTION_DAYS } from "@/config/legal";
import { hasActiveConsent } from "@/lib/consent";
import { db } from "@/lib/db";
import { parseList } from "@/lib/json-fields";
import { notify } from "@/lib/notify";
import { toSearchText } from "@/lib/tr";
import { decide, profileFromAnalysis, REASON_REVIEW } from "./decision";
import type { DecisionStatus } from "./decision";
import { extractFromImage, extractFromPdf, MIN_OCR_CONFIDENCE, MIN_PDF_TEXT_CHARS } from "./extract";
import type { PdfSignals } from "./extract";
import { maskDocumentText } from "./mask";
import { matchName } from "./name-match";
import { getVerifierProvider } from "./providers";
import type { AiAnalysis, VerifierProvider } from "./providers";
import { MAX_DOCUMENT_BYTES, sniffFileType } from "./sniff";

// Belge doğrulama hattının giriş noktası (spec §5.1). Bütün adımlar tek çağrıda, bellek üzerinde
// çalışır. Belge baytları ve metni hiçbir yerde loglanmaz ya da saklanmaz (maskeli metin hariç,
// ve o yalnızca MANUAL_REVIEW'da, süreli olarak).

export type OutcomeStatus = DecisionStatus | "ERROR";

export interface VerificationOutcome {
  status: OutcomeStatus;
  message: string;
  consumedAttempt: boolean;
  processingMs: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ATTEMPT_WINDOW_MS = DAY_MS;
const MAX_ATTEMPTS_PER_WINDOW = 5;

export const MESSAGES = {
  ALREADY_VERIFIED: "Belgen zaten doğrulanmış.",
  ATTEMPT_LIMIT: "24 saat içinde en fazla 5 belge yükleyebilirsin. Daha sonra tekrar dene.",
  UNSUPPORTED_TYPE: "Yalnızca PDF, JPEG, PNG veya WebP yükleyebilirsin.",
  TOO_LARGE: "Dosya 10 MB'tan büyük olamaz.",
  NO_TEXT:
    "Bu PDF'te okunabilir metin yok (taranmış olabilir). Belgenin fotoğrafını veya e-Devlet PDF'ini yükle.",
  OCR_FAILED:
    "Fotoğraf okunamadı. Belgeyi düz bir zeminde, iyi ışıkta ve tamamı görünecek şekilde tekrar çek.",
  READ_FAILED: "Bu dosya okunamadı. Belgeyi yeniden indirip tekrar yükle.",
  UNAVAILABLE: "Belge doğrulama şu an kullanılamıyor. Daha sonra tekrar dene.",
  NO_USER: "Oturumun süresi dolmuş. Tekrar giriş yap.",
  APPROVED: "Belgen doğrulandı. Eğitim bilgilerin profiline yazıldı.",
} as const;

type Source = "PDF_TEXT" | "OCR";

interface StartedRun {
  userId: string;
  started: number;
}

function outcome(status: OutcomeStatus, message: string, consumedAttempt: boolean, started: number): VerificationOutcome {
  return { status, message, consumedAttempt, processingMs: Date.now() - started };
}

function documentHash(pepper: string, bytes: Uint8Array): string {
  return createHmac("sha256", pepper).update(bytes).digest("hex");
}

/**
 * Hatalı girdileri (boyut, tür, okunamayan belge) veritabanına ERROR olarak kaydeder.
 * ERROR kayıtları deneme sınırına sayılmaz ve metin içermez.
 */
async function recordError(
  run: StartedRun,
  docHash: string,
  source: Source,
  message: string,
): Promise<VerificationOutcome> {
  await db.verificationAttempt.create({
    data: {
      userId: run.userId,
      status: "ERROR",
      source,
      docHash,
      nameMatch: false,
      rejectReason: message,
      processingMs: Date.now() - run.started,
    },
  });
  return outcome("ERROR", message, false, run.started);
}

/** Belgeyi doğrular ve sonucu kalıcılaştırır. Çağıranın `bytes` dizisi işlem sonunda sıfırlanır. */
export async function verifyDocument(params: {
  userId: string;
  bytes: Uint8Array;
}): Promise<VerificationOutcome> {
  const { userId, bytes } = params;
  try {
    return await runVerification(userId, bytes);
  } finally {
    bytes.fill(0);
  }
}

async function runVerification(userId: string, bytes: Uint8Array): Promise<VerificationOutcome> {
  const started = Date.now();
  const run: StartedRun = { userId, started };

  // Adım 1: kullanıcı ve doğrulama durumu.
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      verificationStatus: true,
      skillsJson: true,
      interestsJson: true,
    },
  });
  if (!user) return outcome("ERROR", MESSAGES.NO_USER, false, started);
  if (user.verificationStatus === "VERIFIED") {
    return outcome("APPROVED", MESSAGES.ALREADY_VERIFIED, false, started);
  }

  const pepper = process.env.DOC_HASH_PEPPER;
  if (!pepper) return outcome("ERROR", MESSAGES.UNAVAILABLE, false, started);

  // Adım 2: 24 saatte en fazla 5 deneme (ERROR kayıtları sayılmaz).
  const windowStart = new Date(Date.now() - ATTEMPT_WINDOW_MS);
  const recentAttempts = await db.verificationAttempt.count({
    where: { userId, status: { not: "ERROR" }, createdAt: { gte: windowStart } },
  });
  if (recentAttempts >= MAX_ATTEMPTS_PER_WINDOW) {
    return outcome("ERROR", MESSAGES.ATTEMPT_LIMIT, false, started);
  }

  // Adım 3: boyut ve gerçek dosya türü.
  const tooLarge = bytes.byteLength > MAX_DOCUMENT_BYTES;
  const fileType = tooLarge ? null : sniffFileType(bytes);
  const earlySource: Source = fileType === "pdf" ? "PDF_TEXT" : "OCR";
  if (tooLarge) return recordError(run, "", earlySource, MESSAGES.TOO_LARGE);
  if (fileType === null) {
    return recordError(run, documentHash(pepper, bytes), earlySource, MESSAGES.UNSUPPORTED_TYPE);
  }

  // Adım 4: belge özeti ve başka bir doğrulanmış hesapta onaylı kullanım.
  const docHash = documentHash(pepper, bytes);
  const reusedElsewhere = await db.verificationAttempt.findFirst({
    where: {
      docHash,
      status: "APPROVED",
      userId: { not: userId },
      user: { verificationStatus: "VERIFIED" },
    },
    select: { id: true },
  });
  const docHashUsedByOtherVerifiedUser = reusedElsewhere !== null;

  // Adım 5: yerel metin çıkarımı.
  let text: string;
  let source: Source;
  let pdfSignals: PdfSignals | undefined;
  let ocrConfidence: number | undefined;
  try {
    if (fileType === "pdf") {
      source = "PDF_TEXT";
      const extracted = await extractFromPdf(bytes);
      text = extracted.text;
      pdfSignals = extracted.signals;
      if (text.trim().length < MIN_PDF_TEXT_CHARS) {
        return recordError(run, docHash, source, MESSAGES.NO_TEXT);
      }
    } else {
      source = "OCR";
      const extracted = await extractFromImage(bytes);
      text = extracted.text;
      ocrConfidence = extracted.confidence;
      if (extracted.confidence < MIN_OCR_CONFIDENCE) {
        return recordError(run, docHash, source, MESSAGES.OCR_FAILED);
      }
    }
  } catch {
    return recordError(run, docHash, fileType === "pdf" ? "PDF_TEXT" : "OCR", MESSAGES.READ_FAILED);
  }

  // Adım 6: yerel ad eşleştirme ve maskeleme.
  const nameMatch = matchName(text, user.firstName, user.lastName, { fuzzy: source === "OCR" });
  const { masked: maskedText } = maskDocumentText(text, {
    firstName: user.firstName,
    lastName: user.lastName,
  });
  text = "";

  // Adım 7: yapay zeka incelemesi (yalnızca açık rıza varsa ve sağlayıcı tanımlıysa).
  let analysis: AiAnalysis | null = null;
  let provider: VerifierProvider | null = null;
  let aiError = false;
  if (await hasActiveConsent(userId, "CROSS_BORDER_AI")) {
    provider = resolveProvider();
    if (provider) {
      try {
        analysis = await provider.analyze({
          maskedText,
          signals:
            source === "PDF_TEXT"
              ? { source, pdf: pdfSignals }
              : { source, ocrConfidence },
          today: new Date().toISOString().slice(0, 10),
        });
      } catch {
        aiError = true;
      }
    }
  }

  // Adım 8: karar.
  const decision = decide({
    analysis,
    aiError,
    nameMatch,
    source,
    docHashUsedByOtherVerifiedUser,
    today: new Date(),
  });

  // Adım 9 ve 10: sonucu kalıcılaştır, kullanıcı durumunu güncelle (tek işlemde).
  const isManual = decision.status === "MANUAL_REVIEW";
  const now = new Date();
  const profile = analysis ? profileFromAnalysis(analysis) : null;

  const attemptData = {
    userId,
    status: decision.status,
    source,
    docHash,
    nameMatch,
    documentType: analysis?.documentType ?? null,
    aiUsed: analysis !== null,
    aiModel: analysis && provider ? provider.model : null,
    aiConfidence: analysis?.confidence ?? null,
    aiSummary: analysis?.summary ?? null,
    redFlagsJson: JSON.stringify(analysis?.redFlags ?? []),
    extractedJson: profile ? JSON.stringify(profile) : "{}",
    maskedText: isManual ? maskedText : null,
    maskedTextExpiresAt: isManual
      ? new Date(now.getTime() + MASKED_TEXT_RETENTION_DAYS * DAY_MS)
      : null,
    rejectReason: decision.reason,
    processingMs: Date.now() - started,
  };

  // APPROVED yalnız AI analizi varken çıkar; bu yüzden profil her zaman dolu olur.
  const userData =
    decision.status === "APPROVED" && profile
      ? {
          verificationStatus: "VERIFIED",
          verifiedAt: now,
          academicStatus: profile.academicStatus,
          university: profile.university,
          faculty: profile.faculty,
          department: profile.department,
          disciplineGroup: profile.disciplineGroup,
          degreeLevel: profile.degreeLevel,
          classYear: profile.classYear,
          graduationYear: profile.graduationYear,
          searchText: toSearchText(
            user.firstName,
            user.lastName,
            user.username,
            profile.university,
            profile.faculty,
            profile.department,
            parseList(user.skillsJson),
            parseList(user.interestsJson),
          ),
        }
      : { verificationStatus: decision.status };

  await db.$transaction([
    db.verificationAttempt.create({ data: attemptData }),
    db.user.update({ where: { id: userId }, data: userData }),
  ]);

  // Adım 11: bildirim.
  await notify({ userId, type: "VERIFICATION_RESULT", data: { status: decision.status } });

  const message =
    decision.status === "APPROVED" ? MESSAGES.APPROVED : decision.reason ?? REASON_REVIEW;
  return outcome(decision.status, message, true, started);
}

/** Sağlayıcı seçimi; yapılandırma hatası (ör. üretimde mock) AI'ı devre dışı bırakır, belgeyi düşürmez. */
function resolveProvider(): VerifierProvider | null {
  try {
    return getVerifierProvider();
  } catch {
    return null;
  }
}

/** Süresi geçmiş maskeli metinleri temizler. Satırları silmez. Temizlenen satır sayısını döndürür. */
export async function purgeExpiredMaskedText(now: Date = new Date()): Promise<number> {
  const result = await db.verificationAttempt.updateMany({
    where: { maskedText: { not: null }, maskedTextExpiresAt: { lte: now } },
    data: { maskedText: null, maskedTextExpiresAt: null },
  });
  return result.count;
}
