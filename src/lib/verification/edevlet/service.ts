import { createHmac } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { MASKED_TEXT_RETENTION_DAYS } from "@/config/legal";
import { db } from "@/lib/db";
import { parseList } from "@/lib/json-fields";
import { notify } from "@/lib/notify";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { toSearchText } from "@/lib/tr";
import { REASON_NAME_MISMATCH, REASON_REUSED, REASON_REVIEW, STUDENT_CERTIFICATE_MAX_AGE_DAYS } from "../decision";
import type { EducationProfile } from "../decision";
import { extractFromPdf } from "../extract";
import { maskDocumentText } from "../mask";
import { matchName } from "../name-match";
import {
  claimVerificationSlot,
  isReusedByOtherVerifiedUser,
  MESSAGES,
  releaseVerificationSlot,
  wasRejectedByAdminForUser,
  withDocHashLock,
} from "../service";
import { parseEDevletDocument, profileFromDocument } from "./document";
import { edevletEnabled, getEDevletClient } from "./index";
import { normalizeBarcode, normalizeTckn } from "./identifiers";

// e-Devlet barkoduyla anında belge doğrulama (spec 2026-11-27 §4). Kullanıcı barkodu ve T.C. kimlik
// noyu girer; sistem e-Devlet'e sorar, dönen resmi belgeden eğitim bilgilerini okur ve karar verir.
// T.C. kimlik no hiçbir yere yazılmaz. Barkod yalnız HMAC özeti olarak saklanır.

export type BarcodeStatus = "APPROVED" | "REJECTED" | "MANUAL_REVIEW" | "ERROR";

export interface BarcodeOutcome {
  status: BarcodeStatus;
  message: string;
  /** Alan hataları (form alanının altında gösterilir). */
  fieldErrors?: { barcode?: string; tckn?: string };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS_PER_WINDOW = 5;

export const BARCODE_MESSAGES = {
  DISABLED: "e-Devlet ile doğrulama şu an kapalı. Belgeni yükleyerek doğrulayabilirsin.",
  INVALID_BARCODE: "Barkod numarasını belgenin sağ alt köşesindeki gibi yaz (harf, rakam ve tire).",
  INVALID_TCKN: "T.C. kimlik numarasını 11 hane olarak kontrol et.",
  NOT_FOUND: "Bu barkod e-Devlet'te bulunamadı. Barkodu belgenin sağ alt köşesinden kontrol edip tekrar dene.",
  MISMATCH: "Barkod ile T.C. kimlik numarası eşleşmedi. İkisini de kontrol et.",
  UNAVAILABLE:
    "e-Devlet'e şu an ulaşılamadı. Biraz sonra tekrar dene ya da belgeni yükleyerek editör incelemesine gönder.",
  RATE_LIMIT: "Kısa sürede çok sorgu yaptın. Bir saat sonra tekrar dene.",
  BUSY: "Doğrulama sistemi şu an yoğun. Birkaç dakika sonra tekrar dene.",
  NOT_UNIVERSITY:
    "Bu barkod bir üniversite öğrenci belgesine ya da mezun belgesine ait değil. e-Devlet'ten YÖK öğrenci belgesi veya mezun belgesi al.",
  INACTIVE: "e-Devlet'teki belgeye göre öğrenciliğin devam etmiyor. Mezunsan mezun belgeni kullan.",
  TOO_OLD: "Bu öğrenci belgesi 6 aydan eski. e-Devlet'ten yeni bir öğrenci belgesi al ve onun barkodunu gir.",
  APPROVED: "Belgen e-Devlet üzerinden doğrulandı. Eğitim bilgilerin profiline yazıldı.",
} as const;

/**
 * e-Devlet belgeyi tanıyıp geçersiz saydığında (ör. bilgiler değişmiş) kullanıcıya e-Devlet'in kendi
 * açıklaması ve ne yapacağı gösterilir.
 */
export function invalidDocumentMessage(edevletMessage: string): string {
  const quoted = edevletMessage.replace(/\s+/g, " ").trim().slice(0, 200);
  const prefix = quoted ? `e-Devlet bu belgeyi artık geçerli saymıyor: "${quoted}"` : "e-Devlet bu belgeyi artık geçerli saymıyor.";
  return `${prefix} e-Devlet'ten yeni bir belge alıp onun barkodunu gir.`;
}

function barcodeHash(pepper: string, barcode: string): string {
  return createHmac("sha256", pepper).update(`edevlet:${barcode}`).digest("hex");
}

/** Doğrulama sonucunu kaydeder ve kullanıcının durumunu günceller (belge kilidi ve işlem altında). */
async function commit(params: {
  userId: string;
  user: { firstName: string; lastName: string; username: string; city: string | null; skillsJson: string; interestsJson: string };
  docHash: string;
  status: "APPROVED" | "REJECTED" | "MANUAL_REVIEW";
  reason: string | null;
  nameMatch: boolean;
  documentType: string | null;
  profile: EducationProfile | null;
  maskedText: string | null;
  started: number;
}): Promise<{ status: "APPROVED" | "REJECTED" | "MANUAL_REVIEW"; reason: string | null; applied: boolean; current: string | null }> {
  const now = new Date();
  return withDocHashLock(params.docHash, () =>
    db.$transaction(async (tx) => {
      let status = params.status;
      let reason = params.reason;
      if (status === "APPROVED" && (await isReusedByOtherVerifiedUser(tx, params.docHash, params.userId))) {
        status = "REJECTED";
        reason = REASON_REUSED;
      }
      if (status === "APPROVED" && (await wasRejectedByAdminForUser(tx, params.docHash, params.userId))) {
        status = "MANUAL_REVIEW";
        reason = REASON_REVIEW;
      }
      const isManual = status === "MANUAL_REVIEW";

      await tx.verificationAttempt.create({
        data: {
          userId: params.userId,
          status,
          source: "EDEVLET",
          docHash: params.docHash,
          nameMatch: params.nameMatch,
          documentType: params.documentType,
          extractedJson: params.profile ? JSON.stringify(params.profile) : "{}",
          maskedText: isManual ? params.maskedText : null,
          maskedTextExpiresAt: isManual && params.maskedText ? new Date(now.getTime() + MASKED_TEXT_RETENTION_DAYS * DAY_MS) : null,
          rejectReason: status === "APPROVED" ? null : reason,
          processingMs: Date.now() - params.started,
        },
      });

      const profile = params.profile;
      const data: Prisma.UserUpdateManyMutationInput =
        status === "APPROVED" && profile
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
                params.user.firstName,
                params.user.lastName,
                params.user.username,
                profile.university,
                profile.faculty,
                profile.department,
                parseList(params.user.skillsJson),
                parseList(params.user.interestsJson),
                params.user.city,
              ),
            }
          : { verificationStatus: status };

      // Doğrulanmış kullanıcı hiçbir sonuçla düşürülmez; ret de bekleyen bir editör incelemesini ezmez.
      const guard = status === "REJECTED" ? ["VERIFIED", "MANUAL_REVIEW"] : ["VERIFIED"];
      const { count } = await tx.user.updateMany({
        where: { id: params.userId, verificationStatus: { notIn: guard } },
        data,
      });
      const current = count > 0 ? status : ((await tx.user.findUnique({ where: { id: params.userId }, select: { verificationStatus: true } }))?.verificationStatus ?? null);
      return { status, reason, applied: count > 0, current };
    }),
  );
}

/**
 * Barkod ve T.C. kimlik noyla doğrulama. Girdi hataları ve e-Devlet'e ulaşılamaması deneme sayılmaz;
 * e-Devlet'in verdiği her yanıt (bulundu, bulunamadı, uyuşmadı) bir deneme olarak kaydedilir.
 */
export async function verifyBarcode(params: { userId: string; barcode: string; tckn: string }): Promise<BarcodeOutcome> {
  if (!edevletEnabled()) return { status: "ERROR", message: BARCODE_MESSAGES.DISABLED };

  const barcode = normalizeBarcode(params.barcode);
  const tckn = normalizeTckn(params.tckn);
  if (!barcode || !tckn) {
    return {
      status: "ERROR",
      message: "Bilgileri kontrol et.",
      fieldErrors: {
        ...(barcode ? {} : { barcode: BARCODE_MESSAGES.INVALID_BARCODE }),
        ...(tckn ? {} : { tckn: BARCODE_MESSAGES.INVALID_TCKN }),
      },
    };
  }

  if (!claimVerificationSlot(params.userId)) return { status: "ERROR", message: MESSAGES.IN_PROGRESS };
  try {
    return await run(params.userId, barcode, tckn);
  } finally {
    releaseVerificationSlot(params.userId);
  }
}

async function run(userId: string, barcode: string, tckn: string): Promise<BarcodeOutcome> {
  const started = Date.now();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      username: true,
      city: true,
      skillsJson: true,
      interestsJson: true,
      role: true,
      verificationStatus: true,
    },
  });
  if (!user) return { status: "ERROR", message: MESSAGES.NO_USER };
  if (user.verificationStatus === "VERIFIED") return { status: "APPROVED", message: MESSAGES.ALREADY_VERIFIED };

  const pepper = process.env.DOC_HASH_PEPPER;
  if (!pepper) return { status: "ERROR", message: MESSAGES.UNAVAILABLE };

  const windowStart = new Date(Date.now() - DAY_MS);
  const recentAttempts = await db.verificationAttempt.count({
    where: { userId, status: { not: "ERROR" }, createdAt: { gte: windowStart } },
  });
  if (recentAttempts >= MAX_ATTEMPTS_PER_WINDOW) return { status: "ERROR", message: MESSAGES.ATTEMPT_LIMIT };

  const docHash = barcodeHash(pepper, barcode);
  // Başka bir doğrulanmış hesapta onaylanmış barkod için e-Devlet'e hiç sorulmaz.
  if (await isReusedByOtherVerifiedUser(db, docHash, userId)) {
    const committed = await commit({
      userId,
      user,
      docHash,
      status: "REJECTED",
      reason: REASON_REUSED,
      nameMatch: false,
      documentType: null,
      profile: null,
      maskedText: null,
      started,
    });
    return finish(userId, committed);
  }

  const perUser = rateLimit(`edevlet:${userId}`, LIMITS.edevletUser[0], LIMITS.edevletUser[1]);
  if (!perUser.ok) return { status: "ERROR", message: BARCODE_MESSAGES.RATE_LIMIT };
  const global = rateLimit("edevlet:global", LIMITS.edevletGlobal[0], LIMITS.edevletGlobal[1]);
  if (!global.ok) return { status: "ERROR", message: BARCODE_MESSAGES.BUSY };

  const result = await getEDevletClient().verify({ barcode, tckn });

  if (result.kind === "UNAVAILABLE") {
    console.warn(`[edevlet] doğrulama yapılamadı: ${result.reason}`);
    return { status: "ERROR", message: BARCODE_MESSAGES.UNAVAILABLE };
  }

  const base = { userId, user, docHash, started };
  if (result.kind === "INVALID") {
    const reason = invalidDocumentMessage(result.message);
    const committed = await commit({ ...base, status: "REJECTED", reason, nameMatch: false, documentType: null, profile: null, maskedText: null });
    return finish(userId, committed);
  }
  if (result.kind === "NOT_FOUND" || result.kind === "MISMATCH") {
    const reason = result.kind === "NOT_FOUND" ? BARCODE_MESSAGES.NOT_FOUND : BARCODE_MESSAGES.MISMATCH;
    const committed = await commit({ ...base, status: "REJECTED", reason, nameMatch: false, documentType: null, profile: null, maskedText: null });
    return { ...(await finish(userId, committed)), fieldErrors: result.kind === "NOT_FOUND" ? { barcode: reason } : { tckn: reason } };
  }

  // Belge bulundu: önce PDF'in metni, yoksa sonuç sayfasının metni okunur.
  let text = result.text;
  if (result.pdf) {
    try {
      const extracted = await extractFromPdf(result.pdf);
      if (extracted.text.trim().length > 0) text = `${extracted.text}\n${result.text}`;
    } catch {
      // PDF okunamazsa sonuç sayfasının metniyle devam edilir.
    } finally {
      result.pdf.fill(0);
    }
  }

  const doc = parseEDevletDocument(text);
  const nameMatch = matchName(text, user.firstName, user.lastName, { fuzzy: false });
  const { masked } = maskDocumentText(text, { firstName: user.firstName, lastName: user.lastName });
  text = "";
  const profile = profileFromDocument(doc);
  const documentType = doc.kind === "STUDENT_CERT" ? "OGRENCI_BELGESI" : doc.kind === "GRADUATE_CERT" ? "MEZUN_BELGESI" : doc.kind;

  const reject = (reason: string) =>
    commit({ ...base, status: "REJECTED", reason, nameMatch, documentType, profile: null, maskedText: null });

  if (doc.kind === "SCHOOL") return finish(userId, await reject(BARCODE_MESSAGES.NOT_UNIVERSITY));
  if (!nameMatch) return finish(userId, await reject(REASON_NAME_MISMATCH));
  if (doc.status === "INACTIVE") return finish(userId, await reject(BARCODE_MESSAGES.INACTIVE));
  if (doc.kind === "STUDENT_CERT" && doc.issueDate && Date.now() - doc.issueDate.getTime() > STUDENT_CERTIFICATE_MAX_AGE_DAYS * DAY_MS) {
    return finish(userId, await reject(BARCODE_MESSAGES.TOO_OLD));
  }

  const complete =
    (doc.kind === "STUDENT_CERT" || doc.kind === "GRADUATE_CERT") &&
    profile.university !== null &&
    profile.department !== null &&
    profile.academicStatus !== null;

  if (!complete) {
    // e-Devlet belgeyi doğruladı ve ad eşleşti ama bilgiler okunamadı: editör tamamlar.
    const committed = await commit({ ...base, status: "MANUAL_REVIEW", reason: REASON_REVIEW, nameMatch, documentType, profile, maskedText: masked });
    return finish(userId, committed);
  }

  const committed = await commit({ ...base, status: "APPROVED", reason: null, nameMatch, documentType, profile, maskedText: null });
  return finish(userId, committed);
}

/** Sonucu kullanıcıya dönecek biçime getirir; durum değiştiyse onay ve inceleme için bildirim gönderir. */
async function finish(userId: string, committed: Awaited<ReturnType<typeof commit>>): Promise<BarcodeOutcome> {
  if (committed.applied && committed.status !== "REJECTED") {
    await notify({ userId, type: "VERIFICATION_RESULT", data: { status: committed.status } });
  }
  return outcomeFrom(committed);
}

function outcomeFrom(committed: Awaited<ReturnType<typeof commit>>): BarcodeOutcome {
  if (!committed.applied && committed.current === "VERIFIED") {
    return { status: "APPROVED", message: MESSAGES.ALREADY_VERIFIED };
  }
  if (!committed.applied && committed.current === "MANUAL_REVIEW" && committed.status === "REJECTED") {
    return { status: "REJECTED", message: committed.reason ?? REASON_REVIEW };
  }
  if (committed.status === "APPROVED") return { status: "APPROVED", message: BARCODE_MESSAGES.APPROVED };
  if (committed.status === "MANUAL_REVIEW") return { status: "MANUAL_REVIEW", message: REASON_REVIEW };
  return { status: "REJECTED", message: committed.reason ?? BARCODE_MESSAGES.NOT_FOUND };
}
