import { createRequire } from "node:module";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE } from "./lib/auth/cookie";
import { config, middleware } from "./middleware";

const mocks = vi.hoisted(() => ({
  renewSessionByToken: vi.fn(),
}));

vi.mock("@/lib/auth/renew", () => ({ renewSessionByToken: mocks.renewSessionByToken }));

function request(cookie?: string) {
  return new NextRequest(new URL("http://localhost/projeler"), {
    headers: cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {},
  });
}

describe("middleware kayan oturum yenilemesi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("çerez yoksa veritabanına gitmez", async () => {
    const response = await middleware(request());

    expect(mocks.renewSessionByToken).not.toHaveBeenCalled();
    expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("yenilendiğinde çerezi yeni süreyle yazar", async () => {
    const expiresAt = new Date("2026-12-08T10:00:00Z");
    mocks.renewSessionByToken.mockResolvedValue({ kind: "renewed", expiresAt });

    const response = await middleware(request("jeton"));

    expect(mocks.renewSessionByToken).toHaveBeenCalledWith("jeton");
    const cookie = response.cookies.get(SESSION_COOKIE);
    expect(cookie?.value).toBe("jeton");
    expect(cookie?.expires).toEqual(expiresAt);
  });

  it("süresi dolmuş ya da bilinmeyen oturumda çerezi siler", async () => {
    mocks.renewSessionByToken.mockResolvedValue({ kind: "expired" });
    const expired = await middleware(request("eski"));
    expect(expired.cookies.get(SESSION_COOKIE)?.value).toBe("");

    mocks.renewSessionByToken.mockResolvedValue({ kind: "none" });
    const unknown = await middleware(request("yok"));
    expect(unknown.cookies.get(SESSION_COOKIE)?.value).toBe("");
  });

  it("yenileme gerekmediğinde çereze dokunmaz", async () => {
    mocks.renewSessionByToken.mockResolvedValue({ kind: "active" });

    const response = await middleware(request("jeton"));

    expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it("veritabanı hatasında isteği bozmaz ve çerezi değiştirmez", async () => {
    mocks.renewSessionByToken.mockRejectedValue(new Error("db down"));

    const response = await middleware(request("jeton"));

    expect(response.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });
});

// Eşleştirici, Next'in derleme sırasında kullandığı işlevle düzenli ifadeye çevrilir (iç API; Next
// sürümü değişirse bu test görünür biçimde kırılır).
const nodeRequire = createRequire(import.meta.url);
const { getMiddlewareMatchers } = nodeRequire("next/dist/build/analysis/get-page-static-info") as {
  getMiddlewareMatchers: (matchers: string[], nextConfig: object) => Array<{ regexp: string }>;
};

describe("middleware eşleştiricisi", () => {
  const patterns = getMiddlewareMatchers(config.matcher, {}).map((m) => new RegExp(m.regexp));
  const matches = (pathname: string) => patterns.some((pattern) => pattern.test(pathname));

  it("sayfa gezintilerinde ve diğer API rotalarında çalışır", () => {
    for (const pathname of ["/", "/projeler", "/projeler/abc", "/dogrulama", "/ayarlar", "/api/conversations", "/api/me/export"]) {
      expect(matches(pathname), pathname).toBe(true);
    }
  });

  it("belge yükleme ve avatar rotalarında çalışmaz (gövde kesilmez, açık önbelleğe çerez yazılmaz)", () => {
    for (const pathname of ["/api/verification", "/api/avatar", "/api/avatar/abc123.webp"]) {
      expect(matches(pathname), pathname).toBe(false);
    }
  });

  it("statik dosyalarda ve uygulama simgesinde çalışmaz", () => {
    for (const pathname of ["/_next/static/chunks/app.js", "/_next/image", "/favicon.ico", "/icon.svg"]) {
      expect(matches(pathname), pathname).toBe(false);
    }
  });
});
