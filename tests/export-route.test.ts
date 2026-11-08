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
});
