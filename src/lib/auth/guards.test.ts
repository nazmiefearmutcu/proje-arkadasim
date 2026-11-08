import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdmin, safeNextPath } from "./guards";

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
    expect(isAdmin({ role: "ADMIN", email: "a@b.com" })).toBe(true);
  });

  it("ADMIN_EMAILS listesindeki e-posta yönetici sayılır, büyük/küçük harf duyarsız", () => {
    vi.stubEnv("ADMIN_EMAILS", "Yonetici@Ornek.com, diger@ornek.com");
    expect(isAdmin({ role: "USER", email: "yonetici@ornek.com" })).toBe(true);
    expect(isAdmin({ role: "USER", email: "DIGER@ornek.com" })).toBe(true);
  });

  it("listede olmayan ve role ADMIN olmayan kullanıcı yönetici değildir", () => {
    vi.stubEnv("ADMIN_EMAILS", "yonetici@ornek.com");
    expect(isAdmin({ role: "USER", email: "ogrenci@ornek.com" })).toBe(false);
  });

  it("ADMIN_EMAILS tanımsızken yalnız role alanına bakar", () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    expect(isAdmin({ role: "USER", email: "a@b.com" })).toBe(false);
  });
});
