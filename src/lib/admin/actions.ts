"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ACADEMIC_STATUSES, DEGREE_LEVELS, disciplineGroupForDepartment } from "@/config/taxonomy";
import type { AcademicStatus, DegreeLevel } from "@/config/taxonomy";
import { fail, ok, zodFieldErrors } from "@/lib/action-result";
import type { ActionResult } from "@/lib/action-result";
import { getCurrentUser, isAdmin } from "@/lib/auth/guards";
import type { CurrentUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { parseList } from "@/lib/json-fields";
import { notify } from "@/lib/notify";
import { CLASS_YEAR_MAX } from "@/lib/settings/limits";
import { toSearchText } from "@/lib/tr";
import { purgeExpiredMaskedText } from "@/lib/verification/service";

// Yönetim eylemleri. Her eylem önce yönetici kontrolü yapar; yönetici değilse hiçbir şey değişmez.
// Her karar AdminAuditLog'a yazılır (spec §6.2). Yönetici kendi doğrulamasıyla ilgili karar veremez.

const NOT_ADMIN_MESSAGE = "Bu işlem için yönetici yetkin yok.";
const SELF_REVIEW_MESSAGE = "Kendi belgeni inceleyemezsin.";
const SELF_REVOKE_MESSAGE = "Kendi doğrulamanı geri alamazsın.";
const DOCUMENT_REUSED_MESSAGE = "Bu belge başka bir doğrulanmış hesapta kullanılmış. Belgeyi reddet.";
const NOT_VERIFIED_MESSAGE = "Bu kullanıcı doğrulanmış durumda değil.";
const ID_MAX = 64;

const ACADEMIC_VALUES = ACADEMIC_STATUSES.map((option) => option.value) as [
  AcademicStatus,
  ...AcademicStatus[],
];
const DEGREE_VALUES = DEGREE_LEVELS.map((option) => option.value) as [DegreeLevel, ...DegreeLevel[]];

function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, { message: `${label} en fazla ${max} karakter olabilir.` })
    .transform((value) => (value.length > 0 ? value : null));
}

function optionalYear(min: number, max: number, label: string) {
  return z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value.length === 0) return null;
      const year = Number(value);
      if (!/^\d+$/.test(value) || year < min || year > max) {
        ctx.addIssue({ code: "custom", message: `${label} ${min}-${max} arasında olmalı.` });
        return z.NEVER;
      }
      return year;
    });
}

/** Yöneticinin onayladığı eğitim alanları. Form metinleri olarak gelir, burada doğrulanır. */
const EducationFieldsSchema = z.object({
  university: z
    .string()
    .trim()
    .min(2, { message: "Üniversite adı en az 2 karakter olmalı." })
    .max(150, { message: "Üniversite adı en fazla 150 karakter olabilir." }),
  faculty: optionalText(150, "Fakülte adı"),
  department: z
    .string()
    .trim()
    .min(2, { message: "Bölüm adı en az 2 karakter olmalı." })
    .max(150, { message: "Bölüm adı en fazla 150 karakter olabilir." }),
  academicStatus: z.enum(ACADEMIC_VALUES, { message: "Durumu seç." }),
  degreeLevel: z
    .union([z.enum(DEGREE_VALUES), z.literal("")])
    .transform((value) => (value === "" ? null : value)),
  // Ayarlar formuyla aynı üst sınır: onaylanan sınıf, sonraki profil kayıtlarında da geçerli kalır.
  classYear: optionalYear(1, CLASS_YEAR_MAX, "Sınıf"),
  graduationYear: optionalYear(1950, 2100, "Mezuniyet yılı"),
});

/** Formdan gelen ham metinler. Doğrulama `EducationFieldsSchema` ile yapılır. */
export type EducationFieldsInput = {
  university: string;
  faculty: string;
  department: string;
  academicStatus: string;
  degreeLevel: string;
  classYear: string;
  graduationYear: string;
};
export type EducationFields = z.output<typeof EducationFieldsSchema>;

const ReasonSchema = z
  .string()
  .trim()
  .min(10, { message: "Gerekçe en az 10 karakter olmalı." })
  .max(500, { message: "Gerekçe en fazla 500 karakter olabilir." });

async function currentAdmin(): Promise<CurrentUser | null> {
  const user = await getCurrentUser();
  return user && isAdmin(user) ? user : null;
}

/** Koşullu yazım tutmadığında işlemi geri almak için kullanılan iç hata. Dışarı sızmaz. */
class ClaimLost extends Error {
  constructor(readonly scope: "attempt" | "user" | "project") {
    super(`claim lost: ${scope}`);
  }
}

/** Aynı belge başka bir doğrulanmış hesapta onaylıysa onay işlemini geri almak için. Dışarı sızmaz. */
class DocumentReused extends Error {
  constructor() {
    super("document reused");
  }
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= ID_MAX;
}

/**
 * Manuel incelemedeki belgeyi onaylar: belge APPROVED, kullanıcı VERIFIED olur, eğitim alanları ve
 * disiplin grubu profile yazılır, maskeli metin silinir. Yalnızca MANUAL_REVIEW durumundaki belge
 * onaylanabilir; eşzamanlı iki onay tek kez işlenir. Yönetici kendi belgesini onaylayamaz. Aynı belge
 * (aynı docHash) başka bir doğrulanmış hesapta onaylıysa onay reddedilir (spec §5.1 adım 2).
 */
export async function approveAttemptAction(
  attemptId: string,
  fields: EducationFieldsInput,
): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return fail(NOT_ADMIN_MESSAGE);
  if (!validId(attemptId)) return fail("Doğrulama kaydı bulunamadı.");

  const parsed = EducationFieldsSchema.safeParse(fields);
  if (!parsed.success) {
    return fail("Bilgileri kontrol et.", zodFieldErrors(parsed.error));
  }
  const data = parsed.data;

  const attempt = await db.verificationAttempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      userId: true,
      status: true,
      docHash: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          username: true,
          city: true,
          skillsJson: true,
          interestsJson: true,
        },
      },
    },
  });
  if (!attempt) return fail("Doğrulama kaydı bulunamadı.");
  if (attempt.userId === admin.id) return fail(SELF_REVIEW_MESSAGE);
  if (attempt.status !== "MANUAL_REVIEW") {
    return fail("Bu belge artık inceleme bekleyen durumda değil.");
  }

  const user = attempt.user;
  const now = new Date();
  const disciplineGroup = disciplineGroupForDepartment(data.department);
  // Ayarlar (settings/actions.ts) ile aynı sıra ve alanlar: onay, kullanıcının yazdığı şehri düşürmez.
  const searchText = toSearchText(
    user.firstName,
    user.lastName,
    user.username,
    data.university,
    data.faculty,
    data.department,
    parseList(user.skillsJson),
    parseList(user.interestsJson),
    user.city,
  );

  try {
    // Belge ve kullanıcı koşullu yazılır; biri tutmazsa işlem geri alınır, hiçbir şey değişmez.
    await db.$transaction(async (tx) => {
      const updated = await tx.verificationAttempt.updateMany({
        where: { id: attempt.id, status: "MANUAL_REVIEW" },
        data: {
          status: "APPROVED",
          reviewedById: admin.id,
          reviewedAt: now,
          maskedText: null,
          maskedTextExpiresAt: null,
          extractedJson: JSON.stringify(data),
          rejectReason: null,
        },
      });
      if (updated.count === 0) throw new ClaimLost("attempt");

      // Aynı belge başka bir doğrulanmış hesapta onaylıysa bir belge iki hesabı doğrulamasın. Kontrol,
      // yazma kilidi alındıktan sonra yapılır; böylece eşzamanlı iki onaydan yalnız biri geçer.
      if (attempt.docHash) {
        const reused = await tx.verificationAttempt.findFirst({
          where: {
            docHash: attempt.docHash,
            status: "APPROVED",
            userId: { not: attempt.userId },
            user: { verificationStatus: "VERIFIED" },
          },
          select: { id: true },
        });
        if (reused) throw new DocumentReused();
      }

      // Kullanıcı yalnızca inceleme bekliyorsa doğrulanır. Başka bir belge onaylanmış ya da
      // reddedilmişse bu belge onaylanamaz; profil üzerine yazılmaz.
      const userUpdated = await tx.user.updateMany({
        where: { id: attempt.userId, verificationStatus: "MANUAL_REVIEW" },
        data: {
          verificationStatus: "VERIFIED",
          verifiedAt: now,
          academicStatus: data.academicStatus,
          university: data.university,
          faculty: data.faculty,
          department: data.department,
          degreeLevel: data.degreeLevel,
          classYear: data.classYear,
          graduationYear: data.graduationYear,
          disciplineGroup,
          searchText,
        },
      });
      if (userUpdated.count === 0) throw new ClaimLost("user");

      await tx.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: "APPROVE_VERIFICATION",
          targetUserId: attempt.userId,
          targetId: attempt.id,
        },
      });
    });
  } catch (error) {
    if (error instanceof DocumentReused) return fail(DOCUMENT_REUSED_MESSAGE);
    if (error instanceof ClaimLost) {
      return error.scope === "attempt"
        ? fail("Bu belge artık inceleme bekleyen durumda değil.")
        : fail("Bu kullanıcı artık inceleme bekleyen durumda değil. Belgeyi reddedebilirsin.");
    }
    throw error;
  }

  await notify({
    userId: attempt.userId,
    type: "VERIFICATION_RESULT",
    data: { status: "APPROVED" },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/dogrulamalar");
  return ok();
}

/**
 * Manuel incelemedeki belgeyi reddeder. Gerekçe kullanıcıya gösterilir. Maskeli metin silinir.
 * Yönetici kendi belgesini reddedemez.
 */
export async function rejectAttemptAction(attemptId: string, reason: string): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return fail(NOT_ADMIN_MESSAGE);
  if (!validId(attemptId)) return fail("Doğrulama kaydı bulunamadı.");

  const parsed = ReasonSchema.safeParse(reason);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Gerekçe geçersiz.", {
      reason: parsed.error.issues[0]?.message ?? "Gerekçe geçersiz.",
    });
  }

  const attempt = await db.verificationAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, userId: true, status: true },
  });
  if (!attempt) return fail("Doğrulama kaydı bulunamadı.");
  if (attempt.userId === admin.id) return fail(SELF_REVIEW_MESSAGE);
  if (attempt.status !== "MANUAL_REVIEW") {
    return fail("Bu belge artık inceleme bekleyen durumda değil.");
  }

  const now = new Date();
  let userUpdated: boolean;
  try {
    userUpdated = await db.$transaction(async (tx) => {
      const updated = await tx.verificationAttempt.updateMany({
        where: { id: attempt.id, status: "MANUAL_REVIEW" },
        data: {
          status: "REJECTED",
          rejectReason: parsed.data,
          reviewedById: admin.id,
          reviewedAt: now,
          maskedText: null,
          maskedTextExpiresAt: null,
        },
      });
      if (updated.count === 0) throw new ClaimLost("attempt");

      // Kullanıcı başka bir belgeyle zaten doğrulanmışsa durumu değişmez; bildirim de gitmez.
      const userResult = await tx.user.updateMany({
        where: { id: attempt.userId, verificationStatus: "MANUAL_REVIEW" },
        data: { verificationStatus: "REJECTED" },
      });

      await tx.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: "REJECT_VERIFICATION",
          targetUserId: attempt.userId,
          targetId: attempt.id,
        },
      });
      return userResult.count > 0;
    });
  } catch (error) {
    if (error instanceof ClaimLost) {
      return fail("Bu belge artık inceleme bekleyen durumda değil.");
    }
    throw error;
  }

  if (userUpdated) {
    await notify({
      userId: attempt.userId,
      type: "VERIFICATION_RESULT",
      data: { status: "REJECTED" },
    });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/dogrulamalar");
  return ok();
}

/** Şikayeti çözüldü olarak işaretler. */
export async function resolveReportAction(reportId: string): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return fail(NOT_ADMIN_MESSAGE);
  if (!validId(reportId)) return fail("Şikayet bulunamadı.");

  const report = await db.report.findUnique({
    where: { id: reportId },
    select: { id: true, status: true },
  });
  if (!report) return fail("Şikayet bulunamadı.");
  if (report.status === "RESOLVED") return ok();

  await db.$transaction([
    db.report.update({ where: { id: report.id }, data: { status: "RESOLVED" } }),
    db.adminAuditLog.create({
      data: { adminId: admin.id, action: "RESOLVE_REPORT", targetId: report.id },
    }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/sikayetler");
  return ok();
}

/**
 * Doğrulanmış bir hesabın doğrulamasını geri alır (spec §5.3, "şikayet + admin geri alma"). Kullanıcı
 * REJECTED olur ve doğrulanmış yetkilerini kaybeder; son onaylı belgesi gerekçeyle REJECTED işaretlenir,
 * böylece /dogrulama gerekçeyi gösterir ve kullanıcı yeni belge yükleyebilir. Yönetici kendi
 * doğrulamasını geri alamaz.
 */
export async function revokeVerificationAction(userId: string, reason: string): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return fail(NOT_ADMIN_MESSAGE);
  if (!validId(userId)) return fail("Kullanıcı bulunamadı.");
  if (userId === admin.id) return fail(SELF_REVOKE_MESSAGE);

  const parsed = ReasonSchema.safeParse(reason);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Gerekçe geçersiz.";
    return fail(message, { reason: message });
  }

  const target = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true },
  });
  if (!target) return fail("Kullanıcı bulunamadı.");

  const now = new Date();
  try {
    // Kullanıcı koşullu yazılır: yalnız hâlâ doğrulanmışsa geri alınır; değilse hiçbir şey değişmez.
    await db.$transaction(async (tx) => {
      const revoked = await tx.user.updateMany({
        where: { id: target.id, verificationStatus: "VERIFIED" },
        data: { verificationStatus: "REJECTED", verifiedAt: null },
      });
      if (revoked.count === 0) throw new ClaimLost("user");

      const approved = await tx.verificationAttempt.findFirst({
        where: { userId: target.id, status: "APPROVED" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { id: true },
      });
      if (approved) {
        await tx.verificationAttempt.update({
          where: { id: approved.id },
          data: {
            status: "REJECTED",
            rejectReason: parsed.data,
            reviewedById: admin.id,
            reviewedAt: now,
          },
        });
      }

      await tx.adminAuditLog.create({
        data: {
          adminId: admin.id,
          action: "REVOKE_VERIFICATION",
          targetUserId: target.id,
          targetId: approved?.id ?? null,
        },
      });
    });
  } catch (error) {
    if (error instanceof ClaimLost) return fail(NOT_VERIFIED_MESSAGE);
    throw error;
  }

  await notify({
    userId: target.id,
    type: "VERIFICATION_RESULT",
    data: { status: "REJECTED" },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/sikayetler");
  revalidatePath(`/u/${target.username}`);
  return ok();
}

/**
 * Şikayet edilen açık projeyi kapatır. Kapalı projeler keşifte gizlenir. Yalnız açık proje kapatılır;
 * zaten kapalıysa hiçbir şey değişmez.
 */
export async function adminCloseProjectAction(projectId: string): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin) return fail(NOT_ADMIN_MESSAGE);
  if (!validId(projectId)) return fail("Proje bulunamadı.");

  const project = await db.project.findUnique({ where: { id: projectId }, select: { id: true } });
  if (!project) return fail("Proje bulunamadı.");

  try {
    await db.$transaction(async (tx) => {
      const closed = await tx.project.updateMany({
        where: { id: project.id, status: "OPEN" },
        data: { status: "CLOSED" },
      });
      if (closed.count === 0) throw new ClaimLost("project");

      await tx.adminAuditLog.create({
        data: { adminId: admin.id, action: "CLOSE_PROJECT", targetId: project.id },
      });
    });
  } catch (error) {
    if (error instanceof ClaimLost) return fail("Bu proje zaten kapalı.");
    throw error;
  }

  revalidatePath("/admin/sikayetler");
  revalidatePath("/projeler");
  revalidatePath(`/projeler/${project.id}`);
  return ok();
}

/** Süresi geçmiş maskeli metinleri temizler. Temizlenen satır sayısını döndürür. */
export async function purgeMaskedTextAction(): Promise<ActionResult<{ count: number }>> {
  const admin = await currentAdmin();
  if (!admin) return fail(NOT_ADMIN_MESSAGE);

  const count = await purgeExpiredMaskedText();
  await db.adminAuditLog.create({
    data: { adminId: admin.id, action: "PURGE_MASKED_TEXT" },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/dogrulamalar");
  return ok({ count });
}
