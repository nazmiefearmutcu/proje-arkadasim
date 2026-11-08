import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { notFound, redirect } from "next/navigation";
import {
  getCurrentUser,
  isAdmin,
  requireAdmin,
  requireUser,
  requireVerified,
  safeNextPath,
  type CurrentUser,
} from "./guards";

// Oturumdaki kullanıcı testte değiştirilir; gerçek çerez ve veritabanı kullanılmaz.
const session = vi.hoisted(() => ({ user: null as CurrentUser | null }));

vi.mock("./session", () => ({
  getSessionUser: vi.fn(async () => (session.user ? { sessionId: "oturum-1", user: session.user } : null)),
}));

// redirect() ve notFound() Next.js'te istisna fırlatır; testte ayırt edilebilir işaretler fırlatılır.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

function makeUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: "kullanici-1",
    email: "kisi@ornek.test",
    firstName: "Ayşe",
    lastName: "Nur",
    username: "ayse.nur",
    avatarPath: null,
    role: "USER",
    verificationStatus: "VERIFIED",
    academicStatus: "STUDENT",
    university: "Test Üniversitesi",
    faculty: null,
    department: "Bilgisayar Mühendisliği",
    disciplineGroup: "yazilim",
    degreeLevel: null,
    classYear: 2,
    graduationYear: null,
    city: null,
    skillsJson: "[]",
    interestsJson: "[]",
    lookingForProject: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("safeNextPath", () => {
  it("tek eğik çizgiyle başlayan iç yolu kabul eder", () => {
    expect(safeNextPath("/projeler")).toBe("/projeler");
  });

  it("protokol-göreli adresi reddeder", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
  });

  it("mutlak adresi reddeder", () => {
    expect(safeNextPath("https://x")).toBe("/");
  });

  it("ters eğik çizgiyle başlayan adresi reddeder", () => {
    expect(safeNextPath("/\\evil")).toBe("/");
  });

  it("tanımsız girdide varsayılana döner", () => {
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath(null, "/projeler")).toBe("/projeler");
  });

  it("kontrol karakteri içeren yolu reddeder", () => {
    expect(safeNextPath("/projeler\nx")).toBe("/");
  });
});

describe("isAdmin", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("role ADMIN olan kullanıcı yöneticidir", () => {
    expect(isAdmin({ role: "ADMIN" })).toBe(true);
  });

  it("ADMIN_EMAILS listesindeki e-posta yetki vermez (e-posta sahipliği doğrulanmaz)", () => {
    vi.stubEnv("ADMIN_EMAILS", "Yonetici@Ornek.com, diger@ornek.com");
    expect(isAdmin({ role: "USER" })).toBe(false);
  });

  it("role ADMIN olmayan kullanıcı yönetici değildir", () => {
    vi.stubEnv("ADMIN_EMAILS", "yonetici@ornek.com");
    expect(isAdmin({ role: "USER" })).toBe(false);
  });
});

describe("yetki yönlendirmeleri (spec §9)", () => {
  beforeEach(() => {
    session.user = null;
    vi.mocked(redirect).mockClear();
    vi.mocked(notFound).mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("getCurrentUser", () => {
    it("oturum yoksa null döner", async () => {
      expect(await getCurrentUser()).toBeNull();
    });

    it("oturumdaki kullanıcıyı döner", async () => {
      session.user = makeUser();
      expect(await getCurrentUser()).toBe(session.user);
    });
  });

  describe("requireUser", () => {
    it("misafiri bitiş adresini koruyarak girişe yönlendirir", async () => {
      await expect(requireUser("/projeler/abc?sekme=ekip")).rejects.toThrow(
        "NEXT_REDIRECT:/giris?next=%2Fprojeler%2Fabc%3Fsekme%3Dekip",
      );
      expect(redirect).toHaveBeenCalledWith("/giris?next=%2Fprojeler%2Fabc%3Fsekme%3Dekip");
    });

    it("bitiş adresi verilmezse düz /giris adresine yönlendirir", async () => {
      await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT:/giris");
      expect(redirect).toHaveBeenCalledWith("/giris");
    });

    it("güvenli olmayan bitiş adresini atar (açık yönlendirme yok)", async () => {
      await expect(requireUser("//evil.com")).rejects.toThrow("NEXT_REDIRECT:/giris");
      expect(redirect).toHaveBeenCalledWith("/giris");
    });

    it.each(["UNVERIFIED", "MANUAL_REVIEW", "VERIFIED"])("giriş yapmış kullanıcıyı (%s) geçirir", async (status) => {
      session.user = makeUser({ verificationStatus: status });
      expect(await requireUser("/ayarlar")).toBe(session.user);
      expect(redirect).not.toHaveBeenCalled();
    });
  });

  describe("requireVerified", () => {
    it("misafiri önce girişe yönlendirir", async () => {
      await expect(requireVerified("/paylas")).rejects.toThrow("NEXT_REDIRECT:/giris?next=%2Fpaylas");
    });

    it.each(["UNVERIFIED", "PENDING", "MANUAL_REVIEW", "REJECTED"])(
      "doğrulanmamış kullanıcıyı (%s) /dogrulama sayfasına yönlendirir",
      async (status) => {
        session.user = makeUser({ verificationStatus: status });
        await expect(requireVerified("/paylas")).rejects.toThrow("NEXT_REDIRECT:/dogrulama");
        expect(redirect).toHaveBeenCalledTimes(1);
        expect(redirect).toHaveBeenCalledWith("/dogrulama");
      },
    );

    it("doğrulanmış kullanıcıyı geçirir", async () => {
      session.user = makeUser({ verificationStatus: "VERIFIED" });
      expect(await requireVerified("/paylas")).toBe(session.user);
      expect(redirect).not.toHaveBeenCalled();
    });
  });

  describe("requireAdmin", () => {
    it("misafire 404 döner (yönetim alanının varlığı gizlenir, girişe yönlendirmez)", async () => {
      await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
      expect(notFound).toHaveBeenCalledTimes(1);
      expect(redirect).not.toHaveBeenCalled();
    });

    it("yönetici olmayan doğrulanmış kullanıcıya 404 döner", async () => {
      session.user = makeUser({ role: "USER", verificationStatus: "VERIFIED" });
      await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
    });

    it("ADMIN_EMAILS listesindeki e-posta yönetim alanını açmaz", async () => {
      vi.stubEnv("ADMIN_EMAILS", "kisi@ornek.test");
      session.user = makeUser({ email: "kisi@ornek.test", role: "USER" });
      await expect(requireAdmin()).rejects.toThrow("NEXT_NOT_FOUND");
    });

    it("yöneticiyi geçirir", async () => {
      session.user = makeUser({ role: "ADMIN" });
      expect(await requireAdmin()).toBe(session.user);
      expect(notFound).not.toHaveBeenCalled();
    });
  });
});
