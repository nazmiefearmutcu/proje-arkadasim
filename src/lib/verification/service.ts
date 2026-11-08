import { createHmac } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { MASKED_TEXT_RETENTION_DAYS } from "@/config/legal";
import { hasActiveConsent } from "@/lib/consent";
import { db } from "@/lib/db";
import { parseList } from "@/lib/json-fields";
import { notify } from "@/lib/notify";
import { toSearchText } from "@/lib/tr";
import { decide, profileFromAnalysis, REASON_REUSED, REASON_REVIEW } from "./decision";
import type { Decision, DecisionStatus } from "./decision";
import {
  DocumentTooLargeError,
  extractFromImage,
  extractFromPdf,
  MIN_OCR_CONFIDENCE,
  MIN_PDF_TEXT_CHARS,
  OcrUnavailableError,
} from "./extract";
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
/**
 * ERROR kayıtları 5 denemelik sınıra sayılmaz (spec §5.1 adım 3), ama her biri yerel OCR/PDF işi
 * demektir. Bu ayrı ve yüksek sınır, okunamayan dosyalarla CPU tüketmeyi durdurur.
 */
export const MAX_ERROR_ATTEMPTS_PER_WINDOW = 20;

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
  IN_PROGRESS: "Önceki belgen hâlâ işleniyor. Sonucu bekle.",
  ERROR_LIMIT: "Çok fazla okunamayan dosya yükledin. 24 saat sonra tekrar dene.",
  PDF_TOO_MANY_PAGES: "PDF en fazla 5 sayfa olabilir. e-Devlet PDF'ini yükle.",
  IMAGE_TOO_LARGE: "Fotoğraf çok büyük. Daha küçük bir fotoğraf yükle.",
  OCR_UNAVAILABLE: "Fotoğraf okuma şu an kullanılamıyor. e-Devlet PDF'ini yükle.",
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

/** Çıkarım hatasını kullanıcıya gösterilecek, eyleme dönük mesaja çevirir. */
function extractionErrorMessage(error: unknown): string {
  if (error instanceof DocumentTooLargeError) {
    return error.kind === "pdf-pages" ? MESSAGES.PDF_TOO_MANY_PAGES : MESSAGES.IMAGE_TOO_LARGE;
  }
  if (error instanceof OcrUnavailableError) return MESSAGES.OCR_UNAVAILABLE;
  return MESSAGES.READ_FAILED;
}

/**
 * İşlenmekte olan kullanıcılar. Uygulama tek Node süreci olarak çalışır; aynı kullanıcının ikinci
 * yüklemesi ilk bitene kadar reddedilir. Böylece sayma-sonra-yazma yarışı (deneme sınırı) ve
 * paralel yüklemelerle CPU tüketimi kapanır.
 */
const inFlight = new Set<string>();

/**
 * Belge özeti başına kilit zinciri. Tekrar kullanım denetimi ile sonucun yazılması bu kilit altında
 * yapılır: aynı belge iki hesapta aynı anda onaylanamaz (SQLite iki ertelenmiş işlemin ikisinin de
 * yazmadan önce okumasına izin verebilir).
 */
const docHashLocks = new Map<string, Promise<void>>();

async function withDocHashLock<T>(docHash: string, fn: () => Promise<T>): Promise<T> {
  const previous = docHashLocks.get(docHash) ?? Promise.resolve();
  let release: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const tail = previous.then(() => current);
  docHashLocks.set(docHash, tail);
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (docHashLocks.get(docHash) === tail) docHashLocks.delete(docHash);
  }
}

/** Belgeyi doğrular ve sonucu kalıcılaştırır. Çağıranın `bytes` dizisi işlem sonunda sıfırlanır. */
export async function verifyDocument(params: {
  userId: string;
  bytes: Uint8Array;
}): Promise<VerificationOutcome> {
  const { userId, bytes } = params;
  // Denetim ve ekleme aynı eşzamanlı adımda (ilk await'ten önce) yapılır; araya başka istek giremez.
  if (inFlight.has(userId)) {
    bytes.fill(0);
    return outcome("ERROR", MESSAGES.IN_PROGRESS, false, Date.now());
  }
  inFlight.add(userId);
  try {
    return await runVerification(userId, bytes);
  } finally {
    inFlight.delete(userId);
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
      city: true,
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

  // Adım 2b: okunamayan dosyalar için ayrı üst sınır. Sınırda çıkarım yapılmaz, kayıt eklenmez.
  const recentErrors = await db.verificationAttempt.count({
    where: { userId, status: "ERROR", createdAt: { gte: windowStart } },
  });
  if (recentErrors >= MAX_ERROR_ATTEMPTS_PER_WINDOW) {
    return outcome("ERROR", MESSAGES.ERROR_LIMIT, false, started);
  }

  // Adım 3: boyut ve gerçek dosya türü.
  const tooLarge = bytes.byteLength > MAX_DOCUMENT_BYTES;
  const fileType = tooLarge ? null : sniffFileType(bytes);
  const earlySource: Source = fileType === "pdf" ? "PDF_TEXT" : "OCR";
  if (tooLarge) return recordError(run, "", earlySource, MESSAGES.TOO_LARGE);
  if (fileType === null) {
    return recordError(run, documentHash(pepper, bytes), earlySource, MESSAGES.UNSUPPORTED_TYPE);
  }

  // Adım 4: belge özeti ve başka bir doğrulanmış hesapta onaylı kullanım. Onay yazılmadan hemen
  // önce, kilit altında bir kez daha bakılır (adım 9).
  const docHash = documentHash(pepper, bytes);
  const docHashUsedByOtherVerifiedUser = await isReusedByOtherVerifiedUser(db, docHash, userId);

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
  } catch (error) {
    return recordError(run, docHash, fileType === "pdf" ? "PDF_TEXT" : "OCR", extractionErrorMessage(error));
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
              ? { source, pdf: maskPdfSignals(pdfSignals) }
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

  // Adım 9 ve 10: sonucu kalıcılaştır, kullanıcı durumunu güncelle (tek işlemde, belge kilidi altında).
  const now = new Date();
  const profile = analysis ? profileFromAnalysis(analysis) : null;

  const attemptDataFor = (final: Decision): Prisma.VerificationAttemptUncheckedCreateInput => {
    const isManual = final.status === "MANUAL_REVIEW";
    return {
      userId,
      status: final.status,
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
      rejectReason: final.reason,
      processingMs: Date.now() - started,
    };
  };

  // APPROVED yalnız AI analizi varken çıkar; bu yüzden profil her zaman dolu olur.
  const userDataFor = (final: Decision): Prisma.UserUpdateManyMutationInput =>
    final.status === "APPROVED" && profile
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
          // Sıra ayarlar kaydıyla aynı (settings/actions.ts): ad, soyad, kullanıcı adı, üniversite,
          // fakülte, bölüm, beceriler, ilgi alanları, şehir.
          searchText: toSearchText(
            user.firstName,
            user.lastName,
            user.username,
            profile.university,
            profile.faculty,
            profile.department,
            parseList(user.skillsJson),
            parseList(user.interestsJson),
            user.city,
          ),
        }
      : { verificationStatus: final.status };

  const committed = await withDocHashLock(docHash, () =>
    db.$transaction(async (tx) => {
      let final: Decision = decision;
      // Analiz sürerken aynı belge başka bir hesapta onaylanmış olabilir: onay öncesi son denetim.
      if (final.status === "APPROVED" && (await isReusedByOtherVerifiedUser(tx, docHash, userId))) {
        final = { status: "REJECTED", reason: REASON_REUSED };
      }

      // Deneme her durumda kaydedilir (sınıra sayılır ve admin geçmişinde görünür).
      await tx.verificationAttempt.create({ data: attemptDataFor(final) });

      // Uzun süren analiz sırasında başka bir yükleme sonucu yazmış olabilir. Doğrulanmış kullanıcı
      // hiçbir sonuçla düşürülmez; ret de bekleyen bir manuel incelemeyi ezmez.
      const guard = final.status === "REJECTED" ? ["VERIFIED", "MANUAL_REVIEW"] : ["VERIFIED"];
      const { count } = await tx.user.updateMany({
        where: { id: userId, verificationStatus: { notIn: guard } },
        data: userDataFor(final),
      });
      if (count > 0) return { final, applied: true, currentStatus: final.status as string | null };

      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { verificationStatus: true },
      });
      return { final, applied: false, currentStatus: current?.verificationStatus ?? null };
    }),
  );

  if (!committed.applied) {
    // Kullanıcının durumu değişmedi: bildirim yok, mesaj güncel durumu anlatır.
    if (committed.currentStatus === "VERIFIED") {
      return outcome("APPROVED", MESSAGES.ALREADY_VERIFIED, true, started);
    }
    return outcome("MANUAL_REVIEW", REASON_REVIEW, true, started);
  }

  const final = committed.final;

  // Adım 11: bildirim.
  await notify({ userId, type: "VERIFICATION_RESULT", data: { status: final.status } });

  const message = final.status === "APPROVED" ? MESSAGES.APPROVED : final.reason ?? REASON_REVIEW;
  return outcome(final.status, message, true, started);
}

type AttemptReader = Pick<Prisma.TransactionClient, "verificationAttempt">;

/** Aynı belge özeti, VERIFIED durumdaki başka bir hesapta APPROVED olarak kayıtlı mı (spec §5.1 adım 2). */
async function isReusedByOtherVerifiedUser(
  client: AttemptReader,
  docHash: string,
  userId: string,
): Promise<boolean> {
  const reused = await client.verificationAttempt.findFirst({
    where: {
      docHash,
      status: "APPROVED",
      userId: { not: userId },
      user: { verificationStatus: "VERIFIED" },
    },
    select: { id: true },
  });
  return reused !== null;
}

/**
 * Bilinen PDF üretici aileleri. Eşleşen alan bu sabit etiketlerden birine indirgenir.
 */
const KNOWN_PDF_GENERATORS: ReadonlyArray<readonly [RegExp, string]> = [
  [/microsoft/i, "Microsoft"],
  [/libreoffice|openoffice/i, "LibreOffice"],
  [/itext/i, "iText"],
  [/pdf-?lib/i, "pdf-lib"],
  [/skia/i, "Skia"],
  [/adobe|acrobat/i, "Adobe"],
];

/**
 * PDF üretici alanları (producer, creator) serbest metindir ve kişi adı, cihaz adı ya da kullanıcı adı
 * taşıyabilir. Bu yüzden ham metin yapay zekaya HİÇ gönderilmez: yalnızca bilinen bir üretici ailesi
 * sabit etiketiyle, bilinmeyen her değer ise "other" olarak gider. Tarih ve sayısal alanlar olduğu gibi kalır.
 */
export function maskPdfSignals(signals: PdfSignals | undefined): PdfSignals | undefined {
  if (!signals) return undefined;
  const coarse = (value: string | null): string | null => {
    if (value === null) return null;
    const hit = KNOWN_PDF_GENERATORS.find(([pattern]) => pattern.test(value));
    return hit ? hit[1] : "other";
  };
  return {
    ...signals,
    producer: coarse(signals.producer),
    creator: coarse(signals.creator),
  };
}

/**
 * Sağlayıcı seçimi; yapılandırma hatası (ör. üretimde mock) AI'ı devre dışı bırakır, belgeyi düşürmez.
 * Üretimde mock zaten başlangıçta durdurulur (src/instrumentation.ts); bu, ikinci savunma hattıdır.
 */
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
