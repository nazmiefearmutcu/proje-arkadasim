import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createUser, resetDb } from "../../../tests/helpers/db";
import { loginAction } from "./login-action";
import { hashPassword } from "./password";

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
  headers: async () => ({ get: (name: string) => (name === "user-agent" ? "vitest-agent" : null) }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const PASSWORD = "Guvenli2026pw";
const GENERIC = "E-posta veya şifre hatalı.";

function formFor(email: string, password: string, next = "") {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
  data.set("next", next);
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

let counter = 0;
async function accountWith(overrides: { verificationStatus?: string } = {}) {
  counter += 1;
  return createUser({
    email: `giris-${Date.now().toString(36)}${counter}@ornek.test`,
    passwordHash: await hashPassword(PASSWORD),
    ...overrides,
  });
}

describe("loginAction", () => {
  beforeEach(async () => {
    await resetDb();
    jar.clear();
    (globalThis as unknown as { __rateLimitEntries?: Map<string, unknown> }).__rateLimitEntries?.clear();
  });

  it("yanlış şifrede genel hata döner ve deneme başarısız olarak kaydedilir", async () => {
    const user = await accountWith();
    const result = await loginAction(null, formFor(user.email, "Yanlis2026pw"));

    expect(result).toEqual({ ok: false, error: GENERIC });
    const events = await db.loginEvent.findMany({ where: { userId: user.id } });
    expect(events).toHaveLength(1);
    expect(events[0].success).toBe(false);
    expect(events[0].userAgent).toBe("vitest-agent");
  });

  it("var olmayan e-postada da aynı genel hatayı döner ve giriş kaydı yazmaz", async () => {
    const startedAt = new Date();
    const result = await loginAction(null, formFor("yok@ornek.test", PASSWORD));

    expect(result).toEqual({ ok: false, error: GENERIC });
    expect(await db.loginEvent.count({ where: { createdAt: { gte: startedAt } } })).toBe(0);
    expect(jar.has("pa_session")).toBe(false);
  });

  it("doğrulanmamış kullanıcı doğru şifreyle ana sayfa yerine belge sayfasına gider", async () => {
    const user = await accountWith({ verificationStatus: "UNVERIFIED" });
    const target = await redirectTarget(loginAction(null, formFor(user.email, PASSWORD, "/")));

    expect(target).toBe("/dogrulama");
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1);
    expect(jar.has("pa_session")).toBe(true);
  });

  it("doğrulanmış kullanıcı güvenli bir next adresine yönlendirilir", async () => {
    const user = await accountWith({ verificationStatus: "VERIFIED" });
    const target = await redirectTarget(loginAction(null, formFor(user.email, PASSWORD, "/projeler")));

    expect(target).toBe("/projeler");
  });

  it("dış adres içeren next değerini ana sayfaya düşürür", async () => {
    const user = await accountWith({ verificationStatus: "VERIFIED" });
    const target = await redirectTarget(loginAction(null, formFor(user.email, PASSWORD, "//evil.example")));

    expect(target).toBe("/");
  });

  it("aynı IP ve e-posta ile on denemeden sonra hız sınırı uygulanır", async () => {
    const user = await accountWith();

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const result = await loginAction(null, formFor(user.email, "Yanlis2026pw"));
      expect(result).toEqual({ ok: false, error: GENERIC });
    }

    const limited = await loginAction(null, formFor(user.email, PASSWORD));
    expect(limited.ok).toBe(false);
    expect(limited.ok === false && limited.error).toMatch(/^Çok fazla deneme yaptın\. \d+ dakika sonra tekrar dene\.$/);
  });

  it("bir hesabın kilitlenmesi başka bir hesabın girişini engellemez", async () => {
    const locked = await accountWith();
    const other = await accountWith({ verificationStatus: "VERIFIED" });

    for (let attempt = 0; attempt < 11; attempt += 1) {
      await loginAction(null, formFor(locked.email, "Yanlis2026pw"));
    }

    const target = await redirectTarget(loginAction(null, formFor(other.email, PASSWORD, "/projeler")));
    expect(target).toBe("/projeler");
  });
});
