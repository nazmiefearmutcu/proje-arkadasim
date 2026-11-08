import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { loginRetentionDays, runPurge } from "@/lib/purge";
import { createUser, resetDb } from "../../tests/helpers/db";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-11-08T12:00:00.000Z");

describe("saklama süresi temizliği", () => {
  const savedRetention = process.env.LOGIN_LOG_RETENTION_DAYS;

  beforeEach(async () => {
    await resetDb();
    delete process.env.LOGIN_LOG_RETENTION_DAYS;
  });

  afterEach(() => {
    if (savedRetention === undefined) delete process.env.LOGIN_LOG_RETENTION_DAYS;
    else process.env.LOGIN_LOG_RETENTION_DAYS = savedRetention;
  });

  it("süresi dolmuş oturumları, kullanılmış ya da süresi dolmuş sıfırlama jetonlarını ve eski giriş kayıtlarını siler", async () => {
    const user = await createUser();

    await db.session.createMany({
      data: [
        { tokenHash: "oturum-suresi-dolmus", userId: user.id, expiresAt: new Date(NOW.getTime() - DAY) },
        { tokenHash: "oturum-taze", userId: user.id, expiresAt: new Date(NOW.getTime() + DAY) },
      ],
    });
    await db.passwordResetToken.createMany({
      data: [
        { tokenHash: "jeton-kullanilmis", userId: user.id, expiresAt: new Date(NOW.getTime() + DAY), usedAt: NOW },
        { tokenHash: "jeton-suresi-dolmus", userId: user.id, expiresAt: new Date(NOW.getTime() - 1000) },
        { tokenHash: "jeton-taze", userId: user.id, expiresAt: new Date(NOW.getTime() + 3600_000) },
      ],
    });
    await db.loginEvent.createMany({
      data: [
        { userId: user.id, ip: "local", userAgent: "test", success: true, createdAt: new Date(NOW.getTime() - 400 * DAY) },
        { userId: user.id, ip: "local", userAgent: "test", success: true, createdAt: new Date(NOW.getTime() - 2 * DAY) },
      ],
    });
    await db.verificationAttempt.createMany({
      data: [
        {
          userId: user.id,
          status: "MANUAL_REVIEW",
          source: "PDF_TEXT",
          docHash: "h1",
          nameMatch: true,
          maskedText: "eski metin",
          maskedTextExpiresAt: new Date(NOW.getTime() - DAY),
        },
        {
          userId: user.id,
          status: "MANUAL_REVIEW",
          source: "OCR",
          docHash: "h2",
          nameMatch: false,
          maskedText: "taze metin",
          maskedTextExpiresAt: new Date(NOW.getTime() + DAY),
        },
      ],
    });

    const counts = await runPurge(NOW);

    expect(counts).toEqual({ maskedTexts: 1, sessions: 1, resetTokens: 2, loginEvents: 1 });

    expect((await db.session.findMany({ select: { tokenHash: true } })).map((s) => s.tokenHash)).toEqual([
      "oturum-taze",
    ]);
    expect(
      (await db.passwordResetToken.findMany({ select: { tokenHash: true } })).map((t) => t.tokenHash),
    ).toEqual(["jeton-taze"]);
    expect(await db.loginEvent.count()).toBe(1);

    const attempts = await db.verificationAttempt.findMany({
      orderBy: { docHash: "asc" },
      select: { docHash: true, maskedText: true },
    });
    expect(attempts).toEqual([
      { docHash: "h1", maskedText: null },
      { docHash: "h2", maskedText: "taze metin" },
    ]);
  });

  it("boş veritabanında sıfır sayılar döner", async () => {
    expect(await runPurge(NOW)).toEqual({ maskedTexts: 0, sessions: 0, resetTokens: 0, loginEvents: 0 });
  });

  it("LOGIN_LOG_RETENTION_DAYS yoksa 365 gün, geçerli bir değerse o değer kullanılır", () => {
    expect(loginRetentionDays()).toBe(365);
    process.env.LOGIN_LOG_RETENTION_DAYS = "30";
    expect(loginRetentionDays()).toBe(30);
    process.env.LOGIN_LOG_RETENTION_DAYS = "abc";
    expect(loginRetentionDays()).toBe(365);
    process.env.LOGIN_LOG_RETENTION_DAYS = "-5";
    expect(loginRetentionDays()).toBe(365);
  });
});
