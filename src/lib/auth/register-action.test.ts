import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createUser, resetDb } from "../../../tests/helpers/db";
import { registerAction } from "./register-action";
import { SESSION_COOKIE } from "./cookie";

// Çerez deposu ve yönlendirme, bu testlerde gerçek Next çalışma zamanı olmadan taklit edilir.
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
  headers: async () => ({ get: (name: string) => (name === "user-agent" ? "vitest" : null) }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

let counter = 0;
function unique(): string {
  counter += 1;
  return `${Date.now().toString(36)}${counter}`;
}

function formFor(overrides: Record<string, string | boolean> = {}) {
  const id = unique();
  const fields: Record<string, string | boolean> = {
    firstName: "Ayşe",
    lastName: "Nur Öztürk",
    email: `ayse-${id}@ornek.test`,
    username: `ayse${id}`,
    password: "Guvenli2026pw",
    passwordRepeat: "Guvenli2026pw",
    privacyNotice: true,
    terms: true,
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === true) data.set(key, "on");
    else if (value !== false) data.set(key, value);
  }
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

describe("registerAction", () => {
  beforeEach(async () => {
    await resetDb();
    jar.clear();
    (globalThis as unknown as { __rateLimitEntries?: Map<string, unknown> }).__rateLimitEntries?.clear();
  });

  it("kullanıcıyı ve üç rıza kaydını oluşturur, oturum açar ve belge sayfasına yönlendirir", async () => {
    const form = formFor({ crossBorderAi: true });
    const target = await redirectTarget(registerAction(null, form));
    expect(target).toBe("/dogrulama?hosgeldin=1");

    const email = form.get("email") as string;
    const user = await db.user.findUniqueOrThrow({ where: { email } });
    expect(user.verificationStatus).toBe("UNVERIFIED");
    expect(user.passwordHash).not.toBe("Guvenli2026pw");
    expect(user.searchText).toContain("ayse");
    expect(jar.has(SESSION_COOKIE)).toBe(true);

    const consents = await db.consent.findMany({ where: { userId: user.id } });
    expect(consents).toHaveLength(3);
    const granted = Object.fromEntries(consents.map((row) => [row.type, row.granted]));
    expect(granted).toEqual({ PRIVACY_NOTICE: true, TERMS: true, CROSS_BORDER_AI: true });
  });

  it("açık rıza işaretlenmezse CROSS_BORDER_AI kaydı granted=false olur", async () => {
    const form = formFor();
    await redirectTarget(registerAction(null, form));

    const user = await db.user.findUniqueOrThrow({ where: { email: form.get("email") as string } });
    const row = await db.consent.findFirstOrThrow({ where: { userId: user.id, type: "CROSS_BORDER_AI" } });
    expect(row.granted).toBe(false);
  });

  it("aynı e-posta ile kayıtta alan hatası döner ve kullanıcı oluşmaz", async () => {
    const existing = await createUser({ email: "dolu@ornek.test" });
    const result = await registerAction(null, formFor({ email: existing.email }));

    expect(result).toEqual({
      ok: false,
      error: "Bilgilerini düzelterek tekrar dene.",
      fieldErrors: { email: "Bu e-posta ile kayıtlı bir hesap var." },
    });
    expect(await db.user.count({ where: { email: existing.email } })).toBe(1);
  });

  it("alınmış kullanıcı adında alan hatası döner", async () => {
    const existing = await createUser({ username: "dolu.ad" });
    const result = await registerAction(null, formFor({ username: existing.username }));

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.fieldErrors).toEqual({ username: "Bu kullanıcı adı alınmış." });
  });

  it("geçersiz kullanıcı adını alan hatasıyla reddeder", async () => {
    const result = await registerAction(null, formFor({ username: "Ali Veli" }));
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.fieldErrors).toHaveProperty("username");
  });

  it("ayrılmış kullanıcı adını reddeder", async () => {
    const result = await registerAction(null, formFor({ username: "admin" }));
    expect(result.ok === false && result.fieldErrors).toEqual({ username: "Bu kullanıcı adı kullanılamaz." });
  });

  it("aydınlatma onayı yoksa kayıt yapılmaz", async () => {
    const form = formFor({ privacyNotice: false });
    const result = await registerAction(null, form);
    expect(result.ok === false && result.fieldErrors).toHaveProperty("privacyNotice");
    expect(await db.user.count({ where: { email: form.get("email") as string } })).toBe(0);
  });

  it("ad alanında rakam varsa alan hatası döner", async () => {
    const result = await registerAction(null, formFor({ firstName: "Ayşe2" }));
    expect(result.ok === false && result.fieldErrors).toHaveProperty("firstName");
  });
});
