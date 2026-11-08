import { db } from "@/lib/db";
import { emailSchema } from "@/lib/auth/schemas";

// Üretimde ilk (ya da yeni) yöneticiyi atamak için operatör işlemi: `npm run make-admin -- <e-posta>`
// (scripts/make-admin.ts). Tohum gibi veri silmez; yalnız var olan bir hesabın rolünü ADMIN yapar.
// Yönetici yetkisi yalnız `role` ile verilir (ADMIN_EMAILS yoktur; bkz. src/lib/auth/guards.ts).

export type MakeAdminResult =
  | { ok: true; username: string; alreadyAdmin: boolean; verified: boolean }
  | { ok: false; error: string };

/** Denetim kaydındaki eylem adı. Komut satırından yapıldığı için `adminId` boştur. */
export const GRANT_ADMIN_ACTION = "GRANT_ADMIN_CLI";

/**
 * Verilen e-postayla kayıtlı hesaba yönetici rolü verir ve denetim kaydı yazar. Hesap yoksa hiçbir şey
 * değiştirmez. Dönen değerde parola, jeton ya da e-posta yoktur; çıktıya yalnız kullanıcı adı yazılır.
 */
export async function makeAdmin(rawEmail: string): Promise<MakeAdminResult> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) {
    return { ok: false, error: "Geçerli bir e-posta adresi verin: npm run make-admin -- <e-posta>" };
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data },
    select: { id: true, username: true, role: true, verificationStatus: true },
  });
  if (!user) {
    return {
      ok: false,
      error: "Bu e-postayla kayıtlı hesap yok. Önce hesabı /kayit sayfasından oluşturun, sonra komutu tekrar çalıştırın.",
    };
  }

  const verified = user.verificationStatus === "VERIFIED";
  if (user.role === "ADMIN") {
    return { ok: true, username: user.username, alreadyAdmin: true, verified };
  }

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } }),
    db.adminAuditLog.create({ data: { adminId: null, action: GRANT_ADMIN_ACTION, targetUserId: user.id } }),
  ]);
  return { ok: true, username: user.username, alreadyAdmin: false, verified };
}
