"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { RESET_TOKEN_MINUTES } from "@/config/legal";
import { db } from "@/lib/db";
import { fail, ok, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { sendMail } from "@/lib/mailer";
import { LIMITS, clientIp, rateLimit } from "@/lib/rate-limit";
import { destroyAllSessionsForUser } from "./session";
import { hashPassword } from "./password";
import { findUsableResetToken } from "./reset-token";
import { forgotPasswordSchema, resetPasswordSchema } from "./schemas";
import { generateToken, hashToken } from "./tokens";

const INVALID_RESET = "Bu bağlantı geçersiz ya da süresi dolmuş. Yeni bir bağlantı iste.";

/**
 * Şifre sıfırlama isteği. Yanıt, e-posta kayıtlı olsa da olmasa da aynıdır (hesap varlığı sızmaz).
 * Kayıtlıysa jeton üretilir (yalnız özeti saklanır) ve bağlantı e-postayla gönderilir.
 */
export async function requestPasswordResetAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: String(formData.get("email") ?? "") });
  if (!parsed.success) {
    return fail("E-posta adresini kontrol et.", zodFieldErrors(parsed.error));
  }
  const email = parsed.data.email;

  const ip = await clientIp();
  const [limit, windowMs] = LIMITS.passwordReset;
  const limited = rateLimit(`passwordReset:${ip}:${email}`, limit, windowMs);
  if (!limited.ok) {
    const minutes = Math.ceil(limited.retryAfterSec / 60);
    return fail(`Çok fazla istek gönderdin. ${minutes} dakika sonra tekrar dene.`);
  }

  const user = await db.user.findUnique({ where: { email }, select: { id: true, email: true } });
  if (user) {
    // Jeton üretimi ve e-posta gönderimi yanıttan sonra yapılır. Böylece kayıtlı ve kayıtsız
    // e-posta için yanıt süresi aynıdır; süreden hesabın varlığı çıkarılamaz.
    after(() => issueResetLink(user.id, user.email));
  }

  return ok();
}

/**
 * Sıfırlama bağlantısının kök adresi. Yalnız `APP_URL` değerinden gelir; isteğin Host ya da
 * X-Forwarded-Host başlığından asla türetilmez (aksi hâlde bir saldırgan, kurbana kendi alan adına
 * giden bir sıfırlama bağlantısı gönderttirebilirdi). Geliştirmede varsayılan yerel adrestir;
 * üretimde `APP_URL` boşsa null döner ve bağlantı gönderilmez.
 */
function resetLinkBase(): string | null {
  const configured = (process.env.APP_URL ?? "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  return process.env.NODE_ENV === "production" ? null : "http://localhost:3000";
}

/** Jeton üretir (yalnız özeti saklanır) ve bağlantıyı e-postayla gönderir. Hata yanıta yansımaz. */
async function issueResetLink(userId: string, email: string): Promise<void> {
  const base = resetLinkBase();
  if (!base) {
    // Kullanılamayan bir bağlantı (ör. localhost) göndermek yerine jeton da e-posta da üretilmez.
    // Adres ve jeton kaydedilmez; yalnız yapılandırma eksiği yazılır.
    console.error("[şifre sıfırlama] APP_URL tanımlı değil; bağlantı gönderilmedi");
    return;
  }

  try {
    const token = generateToken();
    await db.passwordResetToken.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TOKEN_MINUTES * 60_000),
      },
    });

    const link = `${base}/sifre-sifirla/${token}`;
    await sendMail({
      to: email,
      subject: "Şifre sıfırlama bağlantın",
      text: [
        "Şifreni sıfırlamak için aşağıdaki bağlantıyı aç:",
        link,
        "",
        `Bağlantı ${RESET_TOKEN_MINUTES} dakika geçerlidir. Bu isteği sen yapmadıysan bu e-postayı yok say.`,
      ].join("\n"),
      // Yalnız geliştirme konsolunda (üretim dışı, SMTP yokken) gizlenmeden yazılır; bkz. sendMail.
      devLink: link,
    });
  } catch {
    // Ayrıntı (adres, jeton) kaydedilmez; yalnız olayın türü yazılır.
    console.error("[şifre sıfırlama] bağlantı üretilemedi ya da e-posta gönderilemedi");
  }
}

/** Yeni şifreyi kaydeder, jetonu kullanılmış işaretler ve tüm oturumları kapatır. */
export async function resetPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    passwordRepeat: String(formData.get("passwordRepeat") ?? ""),
  });
  if (!parsed.success) {
    return fail("Şifreni kontrol et.", zodFieldErrors(parsed.error));
  }

  const token = String(formData.get("token") ?? "");
  const record = await findUsableResetToken(token);
  if (!record) return fail(INVALID_RESET);

  const passwordHash = await hashPassword(parsed.data.password);
  const now = new Date();

  // Jetonu koşullu olarak işaretle: aynı anda iki istek gelirse yalnız biri kazanır.
  const claimed = await db.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: now },
  });
  if (claimed.count !== 1) return fail(INVALID_RESET);

  await db.user.update({ where: { id: record.userId }, data: { passwordHash } });
  await db.passwordResetToken.updateMany({
    where: { userId: record.userId, usedAt: null },
    data: { usedAt: now },
  });
  await destroyAllSessionsForUser(record.userId);

  redirect("/giris?sifre=yenilendi");
}
