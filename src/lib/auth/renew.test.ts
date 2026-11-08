import { beforeEach, describe, expect, it, vi } from "vitest";
import { renewSessionByToken } from "./renew";
import { hashToken } from "./tokens";

const DAY_MS = 24 * 60 * 60 * 1000;

const mocks = vi.hoisted(() => ({
  db: {
    session: { findUnique: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));

const NOW = Date.parse("2026-11-08T10:00:00Z");

function row(expiresInMs: number) {
  return { id: "sess-1", expiresAt: new Date(NOW + expiresInMs) };
}

describe("renewSessionByToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("jetona karşılık gelen oturum yoksa none döner ve hiçbir şey yazmaz", async () => {
    mocks.db.session.findUnique.mockResolvedValue(null);

    expect(await renewSessionByToken("bilinmeyen", NOW)).toEqual({ kind: "none" });
    expect(mocks.db.session.update).not.toHaveBeenCalled();
    expect(mocks.db.session.deleteMany).not.toHaveBeenCalled();
  });

  it("veritabanında jeton özetiyle arar, ham jetonla değil", async () => {
    mocks.db.session.findUnique.mockResolvedValue(null);

    await renewSessionByToken("ham-jeton", NOW);

    expect(mocks.db.session.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tokenHash: hashToken("ham-jeton") } }),
    );
  });

  it("süresi dolmuş oturumu siler ve expired döner", async () => {
    mocks.db.session.findUnique.mockResolvedValue(row(-DAY_MS));

    expect(await renewSessionByToken("jeton", NOW)).toEqual({ kind: "expired" });
    expect(mocks.db.session.deleteMany).toHaveBeenCalledWith({ where: { id: "sess-1" } });
    expect(mocks.db.session.update).not.toHaveBeenCalled();
  });

  it("15 günden fazla kaldıysa active döner ve hiçbir şey yazmaz", async () => {
    mocks.db.session.findUnique.mockResolvedValue(row(20 * DAY_MS));

    expect(await renewSessionByToken("jeton", NOW)).toEqual({ kind: "active" });
    expect(mocks.db.session.update).not.toHaveBeenCalled();
  });

  it("15 günden az kaldıysa veritabanı süresini 30 güne uzatır ve renewed döner", async () => {
    mocks.db.session.findUnique.mockResolvedValue(row(3 * DAY_MS));

    const outcome = await renewSessionByToken("jeton", NOW);

    expect(outcome.kind).toBe("renewed");
    if (outcome.kind !== "renewed") return;
    expect(outcome.expiresAt.getTime()).toBe(NOW + 30 * DAY_MS);
    expect(mocks.db.session.update).toHaveBeenCalledWith({
      where: { id: "sess-1" },
      data: { expiresAt: outcome.expiresAt },
    });
  });
});
