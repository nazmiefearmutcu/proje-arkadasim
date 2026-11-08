import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createUser, resetDb } from "../../../tests/helpers/db";
import { documentReuseByAttempt } from "./document-reuse";

async function createAttempt(userId: string, status: string, docHash: string) {
  return db.verificationAttempt.create({
    data: { userId, status, source: "PDF_TEXT", docHash, nameMatch: true },
  });
}

async function pendingUser() {
  return createUser({ verificationStatus: "MANUAL_REVIEW", verifiedAt: null });
}

beforeEach(async () => {
  await resetDb();
});

describe("documentReuseByAttempt", () => {
  it("aynı belge iki hesapta incelemedeyse ikisi de 'incelemede' olarak işaretlenir", async () => {
    const a = await pendingUser();
    const b = await pendingUser();
    const attemptA = await createAttempt(a.id, "MANUAL_REVIEW", "shared");
    const attemptB = await createAttempt(b.id, "MANUAL_REVIEW", "shared");

    const reuse = await documentReuseByAttempt([attemptA, attemptB]);

    expect(reuse.get(attemptA.id)).toBe("incelemede");
    expect(reuse.get(attemptB.id)).toBe("incelemede");
  });

  it("aynı belge doğrulanmış bir hesapta onaylıysa 'onaylı' olur; inceleme kaydından önce gelir", async () => {
    const verified = await createUser();
    await createAttempt(verified.id, "APPROVED", "shared");
    const other = await pendingUser();
    await createAttempt(other.id, "MANUAL_REVIEW", "shared");
    const pending = await pendingUser();
    const attempt = await createAttempt(pending.id, "MANUAL_REVIEW", "shared");

    const reuse = await documentReuseByAttempt([attempt]);

    expect(reuse.get(attempt.id)).toBe("onaylı");
  });

  it("aynı kullanıcının kendi kayıtları, reddedilmiş kayıtlar ve doğrulaması kalkmış hesaplar sayılmaz", async () => {
    const pending = await pendingUser();
    const attempt = await createAttempt(pending.id, "MANUAL_REVIEW", "shared");
    await createAttempt(pending.id, "MANUAL_REVIEW", "shared");
    const rejectedUser = await createUser({ verificationStatus: "REJECTED", verifiedAt: null });
    await createAttempt(rejectedUser.id, "REJECTED", "shared");
    await createAttempt(rejectedUser.id, "APPROVED", "shared");

    const reuse = await documentReuseByAttempt([attempt]);

    expect(reuse.has(attempt.id)).toBe(false);
  });

  it("boş özet ve boş liste için sorgu yapmadan boş sonuç döner", async () => {
    const a = await pendingUser();
    const b = await pendingUser();
    const attemptA = await createAttempt(a.id, "MANUAL_REVIEW", "");
    await createAttempt(b.id, "MANUAL_REVIEW", "");

    expect((await documentReuseByAttempt([attemptA])).size).toBe(0);
    expect((await documentReuseByAttempt([])).size).toBe(0);
  });
});
