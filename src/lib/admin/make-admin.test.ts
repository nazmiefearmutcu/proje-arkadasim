import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createUser, resetDb } from "../../../tests/helpers/db";
import { GRANT_ADMIN_ACTION, makeAdmin } from "./make-admin";

describe("makeAdmin (npm run make-admin)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("var olan hesaba yönetici rolü verir ve denetim kaydı yazar", async () => {
    const user = await createUser({ email: "operator@ornek.test", username: "operator" });

    const result = await makeAdmin("operator@ornek.test");

    expect(result).toEqual({ ok: true, username: "operator", alreadyAdmin: false, verified: true });
    const updated = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.role).toBe("ADMIN");
    const audit = await db.adminAuditLog.findMany();
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({ adminId: null, action: GRANT_ADMIN_ACTION, targetUserId: user.id });
  });

  it("e-postayı büyük/küçük harf ve boşluktan bağımsız eşleştirir", async () => {
    const user = await createUser({ email: "karisik@ornek.test" });

    const result = await makeAdmin("  Karisik@Ornek.TEST ");

    expect(result.ok).toBe(true);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe("ADMIN");
  });

  it("kayıtlı olmayan e-postayı reddeder ve hiçbir şeyi değiştirmez", async () => {
    const other = await createUser({ email: "baska@ornek.test" });

    const result = await makeAdmin("yok@ornek.test");

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/kayıtlı hesap yok/);
    expect((await db.user.findUniqueOrThrow({ where: { id: other.id } })).role).toBe("USER");
    expect(await db.user.count({ where: { role: "ADMIN" } })).toBe(0);
    expect(await db.adminAuditLog.count()).toBe(0);
  });

  it("geçersiz e-postayı reddeder", async () => {
    const result = await makeAdmin("e-posta-degil");
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toMatch(/Geçerli bir e-posta/);
  });

  it("zaten yönetici olan hesapta değişiklik yapmaz ve yeni denetim kaydı yazmaz", async () => {
    await createUser({ email: "yonetici@ornek.test", username: "yonetici_x", role: "ADMIN" });

    const result = await makeAdmin("yonetici@ornek.test");

    expect(result).toEqual({ ok: true, username: "yonetici_x", alreadyAdmin: true, verified: true });
    expect(await db.adminAuditLog.count()).toBe(0);
  });

  it("doğrulanmamış hesabı da yönetici yapar ve bunu sonuçta bildirir", async () => {
    await createUser({
      email: "dogrulanmamis@ornek.test",
      verificationStatus: "UNVERIFIED",
      verifiedAt: null,
    });

    const result = await makeAdmin("dogrulanmamis@ornek.test");

    expect(result.ok && result.verified).toBe(false);
    expect(result.ok && result.alreadyAdmin).toBe(false);
  });

  it("sonuçta parola özeti, e-posta ya da kimlik bulunmaz", async () => {
    await createUser({ email: "gizli@ornek.test", passwordHash: "scrypt$gizli-ozet" });

    const result = await makeAdmin("gizli@ornek.test");

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("gizli-ozet");
    expect(serialized).not.toContain("gizli@ornek.test");
  });
});
