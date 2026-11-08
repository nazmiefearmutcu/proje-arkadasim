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

describe("getSessionUser (yalnız okur; yenileme middleware'de)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.store.get.mockReturnValue({ value: "token-degeri" });
  });

  it("geçerli oturumda kullanıcıyı döner ve çerez ya da veritabanına yazmaz", async () => {
    mocks.db.session.findUnique.mockResolvedValue(sessionRow(3 * DAY_MS));

    const result = await getSessionUser();

    expect(result?.user.id).toBe("user-1");
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

  it("çerez yoksa veritabanına gitmeden null döner", async () => {
    mocks.store.get.mockReturnValue(undefined);

    expect(await getSessionUser()).toBeNull();
    expect(mocks.db.session.findUnique).not.toHaveBeenCalled();
    expect(SESSION_COOKIE).toBe("pa_session");
  });
});
