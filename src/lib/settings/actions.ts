"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { disciplineGroupForDepartment } from "@/config/taxonomy";
import { removeUserAvatars } from "@/lib/avatar-storage";
import { getCurrentUser, isVerified } from "@/lib/auth/guards";
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";
import { destroySession, getCurrentSessionId } from "@/lib/auth/session";
import { fail, ok, type ActionResult } from "@/lib/action-result";
import { hasActiveConsent, recordConsent } from "@/lib/consent";
import { db } from "@/lib/db";
import { toListJson } from "@/lib/json-fields";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { toSearchText } from "@/lib/tr";
import { INTERESTS_MAX, SKILLS_MAX } from "./limits";
import { deleteAccountSchema, parseProfileForm, passwordFormSchema, readText } from "./validation";

// Ayarlar Server Action'ları (spec §4.10, §6.2). Her işlem oturumu sunucuda yeniden doğrular;
// formdan gelen kimlik ya da kurum alanları asla kullanılmaz.

const SESSION_EXPIRED = "Oturumun süresi dolmuş. Tekrar giriş yap.";

/**
 * Mevcut şifre denetimlerinin hız sınırı (kullanıcı başına, şifre değiştirme ve hesap silme
 * ortak). Çalınmış bir oturum çereziyle şifrenin deneme yanılmayla bulunmasını engeller.
 * Sınır aşıldıysa kullanıcıya gösterilecek hata metnini, aşılmadıysa null döner.
 */
function passwordCheckLimited(userId: string): string | null {
  const [limit, windowMs] = LIMITS.passwordCheck;
  const limited = rateLimit(`passwordCheck:${userId}`, limit, windowMs);
  if (limited.ok) return null;
  const minutes = Math.ceil(limited.retryAfterSec / 60);
  return `Çok fazla deneme yaptın. ${minutes} dakika sonra tekrar dene.`;
}

/** Onay alanına "@kullanici" yazılırsa baştaki tek "@" yok sayılır. */
function normalizeUsernameConfirm(value: string): string {
  return value.startsWith("@") ? value.slice(1) : value;
}

/** Profil: ad, soyad ve üniversite değiştirilemez; eğitim alanları yalnız doğrulanmış hesapta yazılır. */
export async function updateProfileAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await getCurrentUser();
  if (!viewer) return fail(SESSION_EXPIRED);

  const verified = isVerified(viewer);
  const parsed = parseProfileForm(formData, {
    verified,
    academicStatus: viewer.academicStatus,
    // Kayıtlı (belgeden ya da yöneticiden gelen) değerler aralık dışında olsa da kaydı engellemez.
    stored: { classYear: viewer.classYear, graduationYear: viewer.graduationYear },
  });
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const input = parsed.data;

  const faculty = verified ? input.faculty : viewer.faculty;
  const department = verified ? input.department : viewer.department;

  const data: Prisma.UserUncheckedUpdateInput = {
    bio: input.bio,
    city: input.city,
    skillsJson: toListJson(input.skills, SKILLS_MAX),
    interestsJson: toListJson(input.interests, INTERESTS_MAX),
    lookingForProject: input.lookingForProject,
    searchText: toSearchText(
      viewer.firstName,
      viewer.lastName,
      viewer.username,
      viewer.university,
      faculty,
      department,
      input.skills,
      input.interests,
      input.city,
    ),
  };

  if (verified) {
    data.faculty = input.faculty;
    data.department = input.department;
    data.degreeLevel = input.degreeLevel;
    data.classYear = input.classYear;
    data.graduationYear = input.graduationYear;
    data.disciplineGroup = disciplineGroupForDepartment(input.department);
  }

  await db.user.update({ where: { id: viewer.id }, data });
  revalidatePath("/ayarlar");
  revalidatePath(`/u/${viewer.username}`);
  return ok();
}

/** Şifre değişimi: mevcut şifre zorunlu; mevcut oturum kalır, diğer tüm oturumlar kapanır. */
export async function changePasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await getCurrentUser();
  if (!viewer) return fail(SESSION_EXPIRED);

  const parsed = passwordFormSchema.safeParse({
    currentPassword: readText(formData, "currentPassword"),
    newPassword: readText(formData, "newPassword"),
    newPasswordRepeat: readText(formData, "newPasswordRepeat"),
  });
  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_form");
      fieldErrors[key] ??= issue.message;
    }
  }
  const { currentPassword, newPassword, newPasswordRepeat } = parsed.success
    ? parsed.data
    : { currentPassword: "", newPassword: "", newPasswordRepeat: "" };

  if (!fieldErrors.newPassword) {
    const strength = validatePasswordStrength(newPassword);
    if (strength) fieldErrors.newPassword = strength;
  }
  if (!fieldErrors.newPassword && newPassword !== newPasswordRepeat) {
    fieldErrors.newPasswordRepeat = "Şifreler eşleşmiyor.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return fail("Şifreni değiştirmek için alanları kontrol et.", fieldErrors);
  }

  const limitedError = passwordCheckLimited(viewer.id);
  if (limitedError) return fail(limitedError);

  const row = await db.user.findUnique({ where: { id: viewer.id }, select: { passwordHash: true } });
  if (!row || !(await verifyPassword(currentPassword, row.passwordHash))) {
    return fail("Mevcut şifren doğru değil.", { currentPassword: "Mevcut şifren doğru değil." });
  }
  if (await verifyPassword(newPassword, row.passwordHash)) {
    return fail("Şifreni değiştirmek için alanları kontrol et.", {
      newPassword: "Yeni şifre eskisiyle aynı olamaz.",
    });
  }

  const passwordHash = await hashPassword(newPassword);
  const currentSessionId = await getCurrentSessionId();
  await db.user.update({ where: { id: viewer.id }, data: { passwordHash } });
  await db.session.deleteMany({
    where: {
      userId: viewer.id,
      ...(currentSessionId ? { id: { not: currentSessionId } } : {}),
    },
  });
  return ok();
}

/** Açık rıza verir (CROSS_BORDER_AI). Zaten etkinse yeni satır yazmaz. */
export async function grantAiConsentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await getCurrentUser();
  if (!viewer) return fail(SESSION_EXPIRED);

  if (formData.get("aiConsent") !== "on") {
    return fail("Rıza vermek için kutuyu işaretle.", {
      aiConsent: "Rıza vermek için kutuyu işaretle.",
    });
  }
  if (!(await hasActiveConsent(viewer.id, "CROSS_BORDER_AI"))) {
    await recordConsent(viewer.id, "CROSS_BORDER_AI", true);
  }
  revalidatePath("/ayarlar");
  revalidatePath("/dogrulama");
  return ok();
}

/**
 * Açık rızayı geri alır: yeni "verilmedi" satırı yazılır (kayıtlar silinmez). Sonraki belgeler
 * yapay zeka yerine manuel incelemeye gider; tamamlanmış doğrulama değişmez.
 */
export async function withdrawAiConsentAction(): Promise<ActionResult> {
  const viewer = await getCurrentUser();
  if (!viewer) return fail(SESSION_EXPIRED);

  if (await hasActiveConsent(viewer.id, "CROSS_BORDER_AI")) {
    await recordConsent(viewer.id, "CROSS_BORDER_AI", false);
  }
  revalidatePath("/ayarlar");
  revalidatePath("/dogrulama");
  return ok();
}

/**
 * Hesabı kalıcı olarak siler. Şifre ve kullanıcı adı onayı zorunlu. Veritabanındaki kaskad
 * ilişkiler projeleri, mesajları, takipleri ve oturumları siler; profil resmi dosyası da kaldırılır.
 */
export async function deleteAccountAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const viewer = await getCurrentUser();
  if (!viewer) return fail(SESSION_EXPIRED);

  const parsed = deleteAccountSchema.safeParse({
    password: readText(formData, "password"),
    usernameConfirm: readText(formData, "usernameConfirm"),
  });
  const fieldErrors: Record<string, string> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_form");
      fieldErrors[key] ??= issue.message;
    }
  }
  const usernameConfirm = normalizeUsernameConfirm(parsed.success ? parsed.data.usernameConfirm : "");
  if (usernameConfirm !== viewer.username) {
    fieldErrors.usernameConfirm = `Onaylamak için kullanıcı adını yaz: ${viewer.username}`;
  }
  if (Object.keys(fieldErrors).length > 0) {
    return fail("Hesabını silmek için bilgileri doldur.", fieldErrors);
  }

  const limitedError = passwordCheckLimited(viewer.id);
  if (limitedError) return fail(limitedError);

  const password = parsed.success ? parsed.data.password : "";
  const row = await db.user.findUnique({ where: { id: viewer.id }, select: { passwordHash: true } });
  if (!row || !(await verifyPassword(password, row.passwordHash))) {
    return fail("Şifre doğrulanamadı.", { password: "Şifren doğru değil." });
  }

  await removeUserAvatars(viewer.id).catch(() => undefined);
  await db.user.delete({ where: { id: viewer.id } });
  await destroySession();
  // redirect bir istisna fırlatır; try/catch içine alınmaz.
  redirect("/?hesap=silindi");
}
