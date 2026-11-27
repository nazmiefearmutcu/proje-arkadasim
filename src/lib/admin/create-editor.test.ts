import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/auth/tokens";
import { createUser, resetDb } from "../../../tests/helpers/db";
import { CREATE_EDITOR_ACTION, createEditor, REPLACE_EDITOR_ACTION } from "./create-editor";

function tokenFrom(path: string): string {
  return path.replace("/sifre-sifirla/", "");
}

describe("createEditor (npm run editor)", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("ayrı, doğrulanmamış bir editör hesabı açar ve parola belirleme jetonu üretir", async () => {
    const result = await createEditor("Editor@Ornek.test");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const editor = await db.user.findUniqueOrThrow({ where: { email: "editor@ornek.test" } });
    expect(editor).toMatchObject({ role: "ADMIN", username: "editor", verificationStatus: "UNVERIFIED", searchText: "" });

    const token = await db.passwordResetToken.findUniqueOrThrow({ where: { tokenHash: hashToken(tokenFrom(result.setupPath)) } });
    expect(token.userId).toBe(editor.id);
    expect(token.usedAt).toBeNull();
    expect(token.expiresAt.getTime()).toBeGreaterThan(Date.now() + 29 * 60_000);

    const audit = await db.adminAuditLog.findMany();
    expect(audit).toMatchObject([{ adminId: null, action: CREATE_EDITOR_ACTION, targetUserId: editor.id }]);
  });

  it("öğrenci hesabının e-postasını reddeder ve hiçbir şey değiştirmez", async () => {
    const student = await createUser({ email: "ogrenci@ornek.test" });

    const result = await createEditor("ogrenci@ornek.test");

    expect(result.ok).toBe(false);
    expect((await db.user.findUniqueOrThrow({ where: { id: student.id } })).role).toBe("USER");
    expect(await db.user.count({ where: { role: "ADMIN" } })).toBe(0);
  });

  it("ikinci bir editörü reddeder; tek editör kuralı", async () => {
    await createEditor("bir@ornek.test");

    const result = await createEditor("iki@ornek.test");

    expect(result.ok).toBe(false);
    expect(await db.user.findMany({ where: { role: "ADMIN" }, select: { email: true } })).toEqual([{ email: "bir@ornek.test" }]);
  });

  it("--replace eski editörü silip yenisini açar", async () => {
    await createEditor("bir@ornek.test");

    const result = await createEditor("iki@ornek.test", { replace: true });

    expect(result).toMatchObject({ ok: true, replaced: true });
    expect(await db.user.findMany({ where: { role: "ADMIN" }, select: { email: true } })).toEqual([{ email: "iki@ornek.test" }]);
    expect(await db.adminAuditLog.count({ where: { action: REPLACE_EDITOR_ACTION } })).toBe(1);
  });

  it("aynı e-postalı editör için yalnız yeni bağlantı üretir", async () => {
    await createEditor("bir@ornek.test");

    const result = await createEditor("bir@ornek.test");

    expect(result).toMatchObject({ ok: true, replaced: false });
    expect(await db.user.count({ where: { role: "ADMIN" } })).toBe(1);
    expect(await db.passwordResetToken.count()).toBe(2);
  });

  it("editor kullanıcı adı alınmışsa ek alır", async () => {
    await createUser({ username: "editor" });

    const result = await createEditor("bir@ornek.test");

    expect(result.ok).toBe(true);
    const editor = await db.user.findFirstOrThrow({ where: { role: "ADMIN" } });
    expect(editor.username).toMatch(/^editor_[a-z0-9]+$/);
  });
});
