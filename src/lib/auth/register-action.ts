"use server";

import { redirect } from "next/navigation";
import { LEGAL_VERSION } from "@/config/legal";
import { db } from "@/lib/db";
import { fail, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { LIMITS, clientIp, rateLimit } from "@/lib/rate-limit";
import { toSearchText } from "@/lib/tr";
import { createSession } from "./session";
import { hashPassword } from "./password";
import { registerSchema } from "./schemas";

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

/**
 * Kayıt: hesap alanları ve üç rıza kaydı tek işlemde yazılır. Belge henüz yüklenmemiştir; kullanıcı
 * `/dogrulama?hosgeldin=1` sayfasına yönlendirilir. Tüm alanlar sunucuda yeniden doğrulanır.
 */
export async function registerAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    firstName: String(formData.get("firstName") ?? ""),
    lastName: String(formData.get("lastName") ?? ""),
    email: String(formData.get("email") ?? ""),
    username: String(formData.get("username") ?? ""),
    password: String(formData.get("password") ?? ""),
    passwordRepeat: String(formData.get("passwordRepeat") ?? ""),
    privacyNotice: formData.get("privacyNotice") === "on",
    terms: formData.get("terms") === "on",
    crossBorderAi: formData.get("crossBorderAi") === "on",
  });
  if (!parsed.success) {
    return fail("Bilgilerini düzelterek tekrar dene.", zodFieldErrors(parsed.error));
  }
  const data = parsed.data;

  const ip = await clientIp();
  const [limit, windowMs] = LIMITS.register;
  const limited = rateLimit(`register:${ip}`, limit, windowMs);
  if (!limited.ok) {
    const minutes = Math.ceil(limited.retryAfterSec / 60);
    return fail(`Çok fazla hesap oluşturma denemesi yaptın. ${minutes} dakika sonra tekrar dene.`);
  }

  const taken = await db.user.findMany({
    where: { OR: [{ email: data.email }, { username: data.username }] },
    select: { email: true, username: true },
  });
  const fieldErrors: Record<string, string> = {};
  if (taken.some((row) => row.email === data.email)) {
    fieldErrors.email = "Bu e-posta ile kayıtlı bir hesap var.";
  }
  if (taken.some((row) => row.username === data.username)) {
    fieldErrors.username = "Bu kullanıcı adı alınmış.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return fail("Bilgilerini düzelterek tekrar dene.", fieldErrors);
  }

  const passwordHash = await hashPassword(data.password);

  let userId: string;
  try {
    const created = await db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          username: data.username,
          verificationStatus: "UNVERIFIED",
          searchText: toSearchText(data.firstName, data.lastName, data.username),
        },
        select: { id: true },
      });
      await tx.consent.createMany({
        data: [
          { userId: user.id, type: "PRIVACY_NOTICE", version: LEGAL_VERSION, granted: true },
          { userId: user.id, type: "TERMS", version: LEGAL_VERSION, granted: true },
          { userId: user.id, type: "CROSS_BORDER_AI", version: LEGAL_VERSION, granted: data.crossBorderAi },
        ],
      });
      return user;
    });
    userId = created.id;
  } catch (error) {
    // Aynı anda gelen iki kayıt yarışında benzersizlik kuralı devreye girer.
    if (isUniqueConstraintError(error)) {
      return fail("Bu e-posta veya kullanıcı adıyla hesap oluşturulamadı. Bilgilerini kontrol et.");
    }
    throw error;
  }

  await createSession(userId);
  redirect("/dogrulama?hosgeldin=1");
}
