import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createUser, resetDb } from "./helpers/db";

const session = vi.hoisted(() => ({ userId: null as string | null }));

vi.mock("@/lib/auth/guards", () => ({
  getCurrentUser: async () => (session.userId ? { id: session.userId } : null),
}));

import { GET } from "@/app/api/me/export/route";

const PASSWORD_HASH = "scrypt$SECRET-PAROLA-OZETI";
const DOC_HASH = "a1b2c3-BELGE-PARMAK-IZI-GIZLI";
const MASKED = "MASKELI-METIN-GIZLI-ICERIK";

describe("GET /api/me/export", () => {
  beforeEach(async () => {
    await resetDb();
    session.userId = null;
  });

  it("oturum yoksa 401 döner", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("profili ve doğrulama kayıtlarını içerir; parola özeti, belge parmak izi ve maskeli metni içermez", async () => {
    const user = await createUser({ passwordHash: PASSWORD_HASH, firstName: "Ayşe", lastName: "Nur" });
    await db.verificationAttempt.create({
      data: {
        userId: user.id,
        status: "MANUAL_REVIEW",
        source: "PDF_TEXT",
        docHash: DOC_HASH,
        nameMatch: true,
        documentType: "OGRENCI_BELGESI",
        aiUsed: false,
        redFlagsJson: JSON.stringify(["düşük güven"]),
        extractedJson: JSON.stringify({ university: "Test Üniversitesi" }),
        maskedText: MASKED,
        maskedTextExpiresAt: new Date(Date.now() + 86_400_000),
        rejectReason: "Belgen ekibimiz tarafından incelenecek.",
      },
    });
    await db.consent.create({
      data: { userId: user.id, type: "CROSS_BORDER_AI", version: "2026-11-08", granted: false },
    });
    session.userId = user.id;

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="proje-arkadasim-verilerim-\d{4}-\d{2}-\d{2}\.json"$/,
    );

    const text = await res.text();
    expect(text).not.toContain("passwordHash");
    expect(text).not.toContain("docHash");
    expect(text).not.toContain("maskedText");
    expect(text).not.toContain(PASSWORD_HASH);
    expect(text).not.toContain(DOC_HASH);
    expect(text).not.toContain(MASKED);

    const json = JSON.parse(text) as {
      exportedAt: string;
      notes: string;
      profile: { email: string; firstName: string };
      verificationAttempts: Array<{ status: string; documentType: string; extractedFields: { university: string } }>;
      consents: Array<{ type: string; granted: boolean }>;
    };
    expect(json.profile.email).toBe(user.email);
    expect(json.profile.firstName).toBe("Ayşe");
    expect(json.verificationAttempts).toHaveLength(1);
    expect(json.verificationAttempts[0]?.status).toBe("MANUAL_REVIEW");
    expect(json.verificationAttempts[0]?.documentType).toBe("OGRENCI_BELGESI");
    expect(json.verificationAttempts[0]?.extractedFields.university).toBe("Test Üniversitesi");
    expect(json.consents).toEqual([expect.objectContaining({ type: "CROSS_BORDER_AI", granted: false })]);
    expect(json.notes).toContain("saklanmaz");
    expect(Number.isNaN(Date.parse(json.exportedAt))).toBe(false);
  });

  it("saklanan bütün giriş kayıtlarını 100 ile sınırlamadan aktarır", async () => {
    const user = await createUser();
    await db.loginEvent.createMany({
      data: Array.from({ length: 140 }, (_, index) => ({
        userId: user.id,
        ip: "203.0.113.7",
        userAgent: "test",
        success: index % 3 !== 0,
        createdAt: new Date(Date.now() - index * 60_000),
      })),
    });
    session.userId = user.id;

    const json = (await (await GET()).json()) as { loginEvents: unknown[] };
    expect(json.loginEvents).toHaveLength(140);
  });

  it("sohbetleri, engellemeleri, şikayetleri, oturumları ve tanıştırmaları sırsız aktarır", async () => {
    const user = await createUser({ username: "ihracat.sahibi" });
    const partner = await createUser({ username: "sohbet.ortagi" });
    const starter = await createUser({ username: "sohbet.baslatan" });
    const blocked = await createUser({ username: "engellenen.kisi" });
    const reported = await createUser({ username: "sikayet.edilen" });
    const suggested = await createUser({ username: "onerilen.kisi" });
    const stranger = await createUser({ username: "baska.biri" });

    const lastMessageAt = new Date("2026-11-07T10:00:00.000Z");
    await db.conversation.create({
      data: {
        userAId: user.id,
        userBId: partner.id,
        initiatorId: user.id,
        status: "ACTIVE",
        lastMessageAt,
        createdAt: new Date("2026-11-01T10:00:00.000Z"),
      },
    });
    await db.conversation.create({
      data: {
        userAId: starter.id,
        userBId: user.id,
        initiatorId: starter.id,
        status: "REQUEST",
        createdAt: new Date("2026-11-02T10:00:00.000Z"),
      },
    });
    // Kullanıcının taraf olmadığı sohbet dökümde yer almamalı.
    await db.conversation.create({
      data: { userAId: partner.id, userBId: stranger.id, initiatorId: partner.id },
    });
    await db.block.create({ data: { blockerId: user.id, blockedId: blocked.id } });
    // Kullanıcıyı engelleyen kişi (başkasının işlemi) dökümde yer almamalı.
    await db.block.create({ data: { blockerId: stranger.id, blockedId: user.id } });
    await db.report.create({
      data: {
        reporterId: user.id,
        targetType: "USER",
        targetId: reported.id,
        reason: "SPAM",
        details: "Sürekli reklam gönderiyor.",
      },
    });
    await db.session.create({
      data: {
        tokenHash: "OTURUM-JETON-OZETI-GIZLI",
        userId: user.id,
        userAgent: "Mozilla/5.0 Test",
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    await db.introduction.create({
      data: { userId: user.id, suggestedUserId: suggested.id, reason: "Aynı bölüm", dismissed: true },
    });
    session.userId = user.id;

    const text = await (await GET()).text();
    expect(text).not.toContain("OTURUM-JETON-OZETI-GIZLI");
    expect(text).not.toContain("tokenHash");
    expect(text).not.toContain(reported.id);
    expect(text).not.toContain("targetId");
    expect(text).not.toContain(stranger.username);

    const json = JSON.parse(text) as {
      notes: string;
      conversations: unknown[];
      blocksGiven: unknown[];
      reportsFiled: unknown[];
      sessions: unknown[];
      introductions: unknown[];
    };
    expect(json.conversations).toEqual([
      {
        partnerUsername: "sohbet.ortagi",
        status: "ACTIVE",
        initiatedByMe: true,
        createdAt: expect.any(String),
        lastMessageAt: lastMessageAt.toISOString(),
      },
      {
        partnerUsername: "sohbet.baslatan",
        status: "REQUEST",
        initiatedByMe: false,
        createdAt: expect.any(String),
        lastMessageAt: null,
      },
    ]);
    expect(json.blocksGiven).toEqual([{ blockedUsername: "engellenen.kisi", createdAt: expect.any(String) }]);
    expect(json.reportsFiled).toEqual([
      {
        targetType: "USER",
        reason: "SPAM",
        details: "Sürekli reklam gönderiyor.",
        status: "OPEN",
        createdAt: expect.any(String),
      },
    ]);
    expect(json.sessions).toEqual([
      { userAgent: "Mozilla/5.0 Test", createdAt: expect.any(String), expiresAt: expect.any(String) },
    ]);
    expect(json.introductions).toEqual([
      { suggestedUsername: "onerilen.kisi", reason: "Aynı bölüm", dismissed: true, createdAt: expect.any(String) },
    ]);
    expect(json.notes).toContain("oturum jetonları");
  });
});
