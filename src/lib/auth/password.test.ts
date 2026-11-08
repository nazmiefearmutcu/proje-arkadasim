import { describe, expect, it } from "vitest";
import { hashPassword, validatePasswordStrength, verifyPassword } from "./password";

describe("şifre özeti", () => {
  it("doğru şifre doğrulanır, yanlış şifre reddedilir", async () => {
    const stored = await hashPassword("Guvenli2026pw");
    expect(await verifyPassword("Guvenli2026pw", stored)).toBe(true);
    expect(await verifyPassword("Guvenli2026px", stored)).toBe(false);
  });

  it("aynı şifrenin iki özeti farklıdır (rastgele tuz)", async () => {
    const a = await hashPassword("Guvenli2026pw");
    const b = await hashPassword("Guvenli2026pw");
    expect(a).not.toBe(b);
  });

  it("saklı biçim scrypt$N$r$p$tuz$özet olur", async () => {
    const stored = await hashPassword("Guvenli2026pw");
    expect(stored.startsWith("scrypt$16384$8$1$")).toBe(true);
    expect(stored.split("$")).toHaveLength(6);
  });

  it("bozuk biçimli saklı değerlerde fırlatmadan false döner", async () => {
    expect(await verifyPassword("herhangi", "")).toBe(false);
    expect(await verifyPassword("herhangi", "bcrypt$10$abc")).toBe(false);
    expect(await verifyPassword("herhangi", "scrypt$abc$8$1$AAAA$AAAA")).toBe(false);
    expect(await verifyPassword("herhangi", "scrypt$1000$8$1$AAAA$AAAA")).toBe(false);
    expect(await verifyPassword("herhangi", "scrypt$16384$8$1$$AAAA")).toBe(false);
    expect(await verifyPassword("herhangi", "scrypt$16384$8$1$AAAA$")).toBe(false);
  });
});

describe("validatePasswordStrength", () => {
  it("kurallara uyan şifre için null döner", () => {
    expect(validatePasswordStrength("Ogrenci2026")).toBeNull();
  });

  it("10 karakterden kısa şifreyi reddeder", () => {
    expect(validatePasswordStrength("abc12345")).toBe("Şifre en az 10 karakter olmalı.");
  });

  it("128 karakterden uzun şifreyi reddeder", () => {
    expect(validatePasswordStrength("a1".repeat(65))).toBe(
      "Şifre en fazla 128 karakter olabilir.",
    );
  });

  it("harf içermeyen şifreyi reddeder", () => {
    expect(validatePasswordStrength("1234567890")).toBe("Şifre en az bir harf içermeli.");
  });

  it("rakam içermeyen şifreyi reddeder", () => {
    expect(validatePasswordStrength("sadeceharfler")).toBe("Şifre en az bir rakam içermeli.");
  });
});
