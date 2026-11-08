import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, getSessionUser } from "./session";

const DAY_MS = 24 * 60 * 60 * 1000;

const mocks = vi.hoisted(() => ({
  store: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  db: {
    session: { findUnique: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  },
}));

vi.mock("next/headers", () => ({
  cookies: async () => mocks.store,
  headers: async () => new Headers(),
}));

vi.mock("@/lib/db", () => ({ db: mocks.db }));

function sessionRow(expiresInMs: number) {
  return {
    id: "sess-1",
    expiresAt: new Date(Date.now() + expiresInMs),
    user: { id: "user-1", email: "ogrenci@ornek.com" },
  };
}

describe("getSessionUser kayan yenileme", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.store.get.mockReturnValue({ value: "token-degeri" });
  });

  it("15 günden az kaldığında çerez yazılabiliyorsa hem çerez hem veritabanı süresi uzar", async () => {
    mocks.db.session.findUnique.mockResolvedValue(sessionRow(3 * DAY_MS));
    mocks.store.set.mockImplementation(() => undefined);

    const result = await getSessionUser();

    expect(result?.user.id).toBe("user-1");
    expect(mocks.store.set).toHaveBeenCalledWith(
      SESSION_COOKIE,
      "token-degeri",
      expect.objectContaining({ expires: expect.any(Date) }),
    );
    expect(mocks.db.session.update).toHaveBeenCalledTimes(1);
    const { expiresAt } = mocks.db.session.update.mock.calls[0][0].data as { expiresAt: Date };
    expect(Math.abs(expiresAt.getTime() - (Date.now() + 30 * DAY_MS))).toBeLessThan(60_000);
  });

  it("çerez yazılamayan bağlamda (Server Component) veritabanı süresi uzatılmaz; çerez ve veritabanı aynı kalır", async () => {
    mocks.db.session.findUnique.mockResolvedValue(sessionRow(3 * DAY_MS));
    mocks.store.set.mockImplementation(() => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler.");
    });

    const result = await getSessionUser();

    expect(result?.user.id).toBe("user-1");
    expect(mocks.db.session.update).not.toHaveBeenCalled();
  });

  it("15 günden fazla kaldığında yenileme yapılmaz", async () => {
    mocks.db.session.findUnique.mockResolvedValue(sessionRow(20 * DAY_MS));

    await getSessionUser();

    expect(mocks.store.set).not.toHaveBeenCalled();
    expect(mocks.db.session.update).not.toHaveBeenCalled();
  });

  it("süresi dolmuş oturumu siler ve null döner", async () => {
    mocks.db.session.findUnique.mockResolvedValue(sessionRow(-DAY_MS));

    const result = await getSessionUser();

    expect(result).toBeNull();
    expect(mocks.db.session.deleteMany).toHaveBeenCalledWith({ where: { id: "sess-1" } });
    expect(mocks.db.session.update).not.toHaveBeenCalled();
  });
});
