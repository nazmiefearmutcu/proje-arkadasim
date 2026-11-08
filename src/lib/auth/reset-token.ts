import { db } from "@/lib/db";
import { hashToken } from "./tokens";

/**
 * Şifre sıfırlama jetonunu çözer. Yalnız kullanılmamış ve süresi dolmamış bir kayıt döner;
 * değilse null. Jeton düz metin olarak saklanmaz, yalnız özeti aranır.
 */
export async function findUsableResetToken(token: string) {
  if (token.length === 0 || token.length > 200) return null;

  const record = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });
  if (!record) return null;
  if (record.usedAt !== null) return null;
  if (record.expiresAt.getTime() <= Date.now()) return null;
  return record;
}
