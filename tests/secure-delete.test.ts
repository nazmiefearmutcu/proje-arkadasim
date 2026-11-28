import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { purgeExpiredMaskedText } from "@/lib/verification/purge-masked";
import { wipeDocumentText } from "@/lib/verification/wipe";
import { createUser, resetDb } from "./helpers/db";

/** Test veritabanının dosyaları (ana dosya ve varsa günlük dosyaları). */
function databaseBytes(): Buffer {
  const url = process.env.DATABASE_URL ?? "";
  const file = url.replace(/^file:/, "");
  const resolved = path.isAbsolute(file) ? file : path.resolve("prisma", file);
  const parts = [resolved, `${resolved}-wal`, `${resolved}-journal`].filter((candidate) => existsSync(candidate));
  return Buffer.concat(parts.map((candidate) => readFileSync(candidate)));
}

/** Sıkıştırılamayan, dosyada tek başına aranabilecek bir işaret (taşma sayfasına düşecek kadar uzun). */
function marker(): string {
  return `GIZLI-${randomBytes(2400).toString("hex")}`;
}

async function attemptWithText(userId: string, text: string, expiresAt = new Date(Date.now() + 86_400_000)) {
  return db.verificationAttempt.create({
    data: { userId, status: "MANUAL_REVIEW", source: "PDF_TEXT", docHash: "h", nameMatch: true, maskedText: text, maskedTextExpiresAt: expiresAt },
  });
}

describe("belge metninin kalıcı silinmesi", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("silinen belge metni veritabanı dosyasında da kalmaz", async () => {
    const user = await createUser();
    const secret = marker();
    await attemptWithText(user.id, secret);
    expect(databaseBytes().includes(secret.slice(0, 64))).toBe(true);

    await db.$transaction((tx) => wipeDocumentText(tx, user.id));

    expect((await db.verificationAttempt.findFirstOrThrow({ where: { userId: user.id } })).maskedText).toBeNull();
    expect(databaseBytes().includes(secret.slice(0, 64))).toBe(false);
  });

  it("süresi dolan metni temizleyen iş de dosyada iz bırakmaz", async () => {
    const user = await createUser();
    const secret = marker();
    await attemptWithText(user.id, secret, new Date(Date.now() - 1000));

    expect(await purgeExpiredMaskedText()).toBe(1);

    expect(databaseBytes().includes(secret.slice(0, 64))).toBe(false);
  });
});
