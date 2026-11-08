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
import { toSearchText } from "@/lib/tr";
import { purgeExpiredMaskedText } from "@/lib/verification/service";

// Yönetim eylemleri. Her eylem önce yönetici kontrolü yapar; yönetici değilse hiçbir şey değişmez.
// Her karar AdminAuditLog'a yazılır (spec §6.2).

const NOT_ADMIN_MESSAGE = "Bu işlem için yönetici yetkin yok.";
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
  classYear: optionalYear(1, 12, "Sınıf"),
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

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= ID_MAX;
}

/**
 * Manuel incelemedeki belgeyi onaylar: belge APPROVED, kullanıcı VERIFIED olur, eğitim alanları ve
 * disiplin grubu profile yazılır, maskeli metin silinir. Yalnızca MANUAL_REVIEW durumundaki belge
 * onaylanabilir; eşzamanlı iki onay tek kez işlenir.
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
      user: {
        select: {
          firstName: true,
          lastName: true,
          username: true,
          skillsJson: true,
          interestsJson: true,
        },
      },
    },
  });
  if (!attempt) return fail("Doğrulama kaydı bulunamadı.");
  if (attempt.status !== "MANUAL_REVIEW") {
    return fail("Bu belge artık inceleme bekleyen durumda değil.");
  }

  const user = attempt.user;
  const now = new Date();
  const disciplineGroup = disciplineGroupForDepartment(data.department);
  const searchText = toSearchText(
    user.firstName,
    user.lastName,
    user.username,
    data.university,
    data.faculty,
    data.department,
    parseList(user.skillsJson),
    parseList(user.interestsJson),
  );

  const claimed = await db.$transaction(async (tx) => {
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
    if (updated.count === 0) return false;

    await tx.user.update({
      where: { id: attempt.userId },
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

    await tx.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: "APPROVE_VERIFICATION",
        targetUserId: attempt.userId,
        targetId: attempt.id,
      },
    });
    return true;
  });

  if (!claimed) return fail("Bu belge artık inceleme bekleyen durumda değil.");

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
  if (attempt.status !== "MANUAL_REVIEW") {
    return fail("Bu belge artık inceleme bekleyen durumda değil.");
  }

  const now = new Date();
  const claimed = await db.$transaction(async (tx) => {
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
    if (updated.count === 0) return false;

    await tx.user.update({
      where: { id: attempt.userId },
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
    return true;
  });

  if (!claimed) return fail("Bu belge artık inceleme bekleyen durumda değil.");

  await notify({
    userId: attempt.userId,
    type: "VERIFICATION_RESULT",
    data: { status: "REJECTED" },
  });

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
