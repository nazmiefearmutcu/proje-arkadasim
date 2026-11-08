import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mailer";
import { createUser, resetDb } from "../../../tests/helpers/db";
import { requestPasswordResetAction, resetPasswordAction } from "./password-reset-action";
import { hashPassword, verifyPassword } from "./password";
import { generateToken, hashToken } from "./tokens";

const jar = vi.hoisted(() => new Map<string, string>());

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = jar.get(name);
      return value === undefined ? undefined : { name, value };
    },
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
  }),
  headers: async () => ({ get: () => null }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock("@/lib/mailer", () => ({
  sendMail: vi.fn(async () => undefined),
}));

const OLD = "Eski2026sifre";
const NEW = "Yeni2026sifre";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function redirectTarget(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const match = /^NEXT_REDIRECT:(.*)$/.exec((error as Error).message);
    if (match) return match[1];
    throw error;
  }
  throw new Error("yönlendirme bekleniyordu");
}

/** Gönderilen e-postadaki sıfırlama jetonunu okur. */
function tokenFromLastMail(): string {
  const calls = vi.mocked(sendMail).mock.calls;
  const text = calls[calls.length - 1]?.[0].text ?? "";
  const match = /\/sifre-sifirla\/([A-Za-z0-9_-]+)/.exec(text);
  if (!match) throw new Error("e-postada bağlantı yok");
  return match[1];
}

describe("şifre sıfırlama", () => {
  beforeEach(async () => {
    await resetDb();
    jar.clear();
    vi.mocked(sendMail).mockClear();
    (globalThis as unknown as { __rateLimitEntries?: Map<string, unknown> }).__rateLimitEntries?.clear();
  });

  it("kayıtlı olmayan e-posta için de başarılı yanıt döner, jeton ve e-posta üretilmez", async () => {
    const result = await requestPasswordResetAction(null, form({ email: "yok@ornek.test" }));

    expect(result).toEqual({ ok: true });
    expect(await db.passwordResetToken.count({ where: { user: { email: "yok@ornek.test" } } })).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("kayıtlı e-posta için jeton üretir (yalnız özeti saklanır) ve bağlantıyı gönderir", async () => {
    const user = await createUser({ email: "sifre@ornek.test" });
    const result = await requestPasswordResetAction(null, form({ email: user.email }));

    expect(result).toEqual({ ok: true });
    expect(sendMail).toHaveBeenCalledTimes(1);

    const token = tokenFromLastMail();
    const stored = await db.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(stored.tokenHash).toBe(hashToken(token));
    expect(stored.tokenHash).not.toBe(token);
  });

  it("geçerli jetonla şifreyi değiştirir, jetonu kullanılmış yapar ve oturumları kapatır", async () => {
    const user = await createUser({ email: "degis@ornek.test", passwordHash: await hashPassword(OLD) });
    const token = generateToken();
    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });
    await db.session.create({
      data: { userId: user.id, tokenHash: "oturum-ozeti", expiresAt: new Date(Date.now() + 60_000) },
    });

    const target = await redirectTarget(
      resetPasswordAction(null, form({ token, password: NEW, passwordRepeat: NEW })),
    );

    expect(target).toBe("/giris?sifre=yenilendi");
    const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(await verifyPassword(NEW, updated.passwordHash)).toBe(true);
    expect(await verifyPassword(OLD, updated.passwordHash)).toBe(false);
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0);
    const row = await db.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(row.usedAt).not.toBeNull();
  });

  it("aynı jeton ikinci kez kullanılamaz", async () => {
    const user = await createUser({ email: "tek-kullanim@ornek.test" });
    const token = generateToken();
    await db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60_000) },
    });

    await expect(
      resetPasswordAction(null, form({ token, password: NEW, passwordRepeat: NEW })),
    ).rejects.toThrow("NEXT_REDIRECT");

    const second = await resetPasswordAction(null, form({ token, password: NEW, passwordRepeat: NEW }));
    expect(second.ok).toBe(false);
    expect(second.ok === false && second.error).toMatch(/geçersiz/);
  });

  it("süresi dolmuş jeton reddedilir", async () => {
    const user = await createUser({ email: "suresi-doldu@ornek.test" });
    const token = generateToken();
    await db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() - 1_000) },
    });

    const result = await resetPasswordAction(null, form({ token, password: NEW, passwordRepeat: NEW }));
    expect(result.ok).toBe(false);
  });

  it("yeni şifre tekrarı eşleşmezse alan hatası döner ve jeton harcanmaz", async () => {
    const user = await createUser({ email: "tekrar@ornek.test" });
    const token = generateToken();
    await db.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60_000) },
    });

    const result = await resetPasswordAction(null, form({ token, password: NEW, passwordRepeat: "Baska2026pw" }));
    expect(result.ok === false && result.fieldErrors).toEqual({ passwordRepeat: "Şifreler eşleşmiyor." });
    const row = await db.passwordResetToken.findFirstOrThrow({ where: { userId: user.id } });
    expect(row.usedAt).toBeNull();
  });
});
