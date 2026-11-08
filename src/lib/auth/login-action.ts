"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { fail, zodFieldErrors, type ActionResult } from "@/lib/action-result";
import { LIMITS, clientIp, loginKey, rateLimit } from "@/lib/rate-limit";
import { createSession } from "./session";
import { safeNextPath } from "./guards";
import { hashPassword, verifyPassword } from "./password";
import { generateToken } from "./tokens";
import { loginSchema } from "./schemas";

const WRONG_CREDENTIALS = "E-posta veya şifre hatalı.";

// Kullanıcı yokken de aynı süre harcamak için bir kez üretilen rastgele özet (kullanıcı varlığını gizler).
let dummyHash: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHash) dummyHash = hashPassword(generateToken());
  return dummyHash;
}

/**
 * Giriş. Hız sınırı IP + e-posta anahtarıyla uygulanır. Hatalı girişte tek bir genel mesaj
 * döner (kullanıcı varlığı sızmaz). Var olan bir hesabın her denemesi `LoginEvent` olarak kaydedilir.
 */
export async function loginAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) {
    return fail("Bilgilerini kontrol et.", zodFieldErrors(parsed.error));
  }
  const { email, password } = parsed.data;
  const next = safeNextPath(String(formData.get("next") ?? ""), "/");

  const ip = await clientIp();
  const [limit, windowMs] = LIMITS.login;
  const limited = rateLimit(loginKey(ip, email), limit, windowMs);
  if (!limited.ok) {
    const minutes = Math.ceil(limited.retryAfterSec / 60);
    return fail(`Çok fazla deneme yaptın. ${minutes} dakika sonra tekrar dene.`);
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true, verificationStatus: true },
  });
  if (!user) {
    await verifyPassword(password, await getDummyHash());
    return fail(WRONG_CREDENTIALS);
  }

  const h = await headers();
  const userAgent = (h.get("user-agent") ?? "").slice(0, 200);
  const valid = await verifyPassword(password, user.passwordHash);

  await db.loginEvent.create({
    data: { userId: user.id, ip, userAgent, success: valid },
  });

  if (!valid) return fail(WRONG_CREDENTIALS);

  await createSession(user.id);

  // Doğrulanmamış kullanıcı ana sayfaya düşmesin: belge adımına yönlendirilir.
  const target = user.verificationStatus !== "VERIFIED" && next === "/" ? "/dogrulama" : next;
  redirect(target);
}
