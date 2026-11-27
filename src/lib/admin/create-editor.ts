import { db } from "@/lib/db";
import { emailSchema } from "@/lib/auth/schemas";
import { hashPassword } from "@/lib/auth/password";
import { generateToken, hashToken } from "@/lib/auth/tokens";

// Tek editör hesabı (spec 2026-11-27 §1). Editör, öğrenci hesabı değildir: ayrı bir hesap olarak açılır,
// rolü ADMIN'dir (arayüzde "Editör"), doğrulanmamış kalır ve bu yüzden aramada ve önerilerde görünmez.
// Sistemde en fazla bir editör bulunur. Parola komut satırına yazılmaz; hesap kullanılamaz rastgele
// bir parolayla açılır ve yalnız tek kullanımlık, süreli bir parola belirleme bağlantısı üretilir.

export const EDITOR_USERNAME = "editor";
export const EDITOR_FIRST_NAME = "ProBuddy";
export const EDITOR_LAST_NAME = "Editör";
export const SETUP_LINK_MINUTES = 30;
export const CREATE_EDITOR_ACTION = "CREATE_EDITOR_CLI";
export const REPLACE_EDITOR_ACTION = "REPLACE_EDITOR_CLI";

export type CreateEditorResult =
  | { ok: true; setupPath: string; replaced: boolean; minutes: number }
  | { ok: false; error: string };

export interface CreateEditorOptions {
  /** Var olan editör hesabını silip yerine yenisini açar. */
  replace?: boolean;
}

/**
 * Editör hesabını açar ve `/sifre-sifirla/<jeton>` yolunu döner. Jeton yalnız bu dönüşte bulunur;
 * veritabanında özeti saklanır. Aynı e-postayla bir öğrenci hesabı varsa ya da başka bir editör varsa
 * (ve `replace` verilmediyse) hiçbir şey değişmez.
 *
 * Aynı e-postalı editör zaten varsa yeni hesap açılmaz; yalnız yeni bir parola belirleme bağlantısı
 * üretilir (parolasını unutan editör için).
 */
export async function createEditor(rawEmail: string, options: CreateEditorOptions = {}): Promise<CreateEditorResult> {
  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) {
    return { ok: false, error: "Geçerli bir e-posta adresi verin: npm run editor -- <e-posta>" };
  }
  const email = parsed.data;

  const [sameEmail, editors] = await Promise.all([
    db.user.findUnique({ where: { email }, select: { id: true, role: true } }),
    db.user.findMany({ where: { role: "ADMIN" }, select: { id: true, email: true } }),
  ]);

  if (sameEmail && sameEmail.role !== "ADMIN") {
    return {
      ok: false,
      error:
        "Bu e-postayla bir öğrenci hesabı kayıtlı. Editör hesabı öğrenci hesabı olamaz; editör için başka bir e-posta kullanın.",
    };
  }

  // Aynı e-postalı editör: yalnız yeni parola belirleme bağlantısı.
  if (sameEmail && sameEmail.role === "ADMIN") {
    const token = await issueSetupToken(sameEmail.id);
    return { ok: true, setupPath: `/sifre-sifirla/${token}`, replaced: false, minutes: SETUP_LINK_MINUTES };
  }

  if (editors.length > 0 && !options.replace) {
    return {
      ok: false,
      error:
        "Sistemde zaten bir editör hesabı var. Yalnız bir editör olabilir. Eski hesabı silip yenisini açmak için: npm run editor -- <e-posta> --replace",
    };
  }

  // Kullanılamaz parola: hiçbir yerde yazılmaz, editör bağlantıdan kendi parolasını belirler.
  const passwordHash = await hashPassword(generateToken(48));

  const userId = await db.$transaction(async (tx) => {
    if (editors.length > 0) {
      await tx.user.deleteMany({ where: { id: { in: editors.map((editor) => editor.id) } } });
    }
    // "editor" ayrılmış bir kullanıcı adıdır; ayrılmadan önce bir öğrenci almışsa ek alır.
    const taken = await tx.user.findUnique({ where: { username: EDITOR_USERNAME }, select: { id: true } });
    const username = taken ? `${EDITOR_USERNAME}_${generateToken(3).toLowerCase().replace(/[^a-z0-9]/g, "0")}` : EDITOR_USERNAME;
    const created = await tx.user.create({
      data: {
        email,
        passwordHash,
        firstName: EDITOR_FIRST_NAME,
        lastName: EDITOR_LAST_NAME,
        username,
        role: "ADMIN",
        // Doğrulanmamış kalır: arama ve öneriler yalnız doğrulanmış hesapları gösterir.
        verificationStatus: "UNVERIFIED",
        searchText: "",
      },
      select: { id: true },
    });
    await tx.adminAuditLog.create({
      data: {
        adminId: null,
        action: editors.length > 0 ? REPLACE_EDITOR_ACTION : CREATE_EDITOR_ACTION,
        targetUserId: created.id,
      },
    });
    return created.id;
  });

  const token = await issueSetupToken(userId);
  return { ok: true, setupPath: `/sifre-sifirla/${token}`, replaced: editors.length > 0, minutes: SETUP_LINK_MINUTES };
}

async function issueSetupToken(userId: string): Promise<string> {
  const token = generateToken();
  await db.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + SETUP_LINK_MINUTES * 60_000),
    },
  });
  return token;
}
