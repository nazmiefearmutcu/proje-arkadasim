import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clientIp, rateLimit } from "./rate-limit";

const requestHeaders = vi.hoisted(() => ({ current: new Headers() }));

vi.mock("next/headers", () => ({
  headers: async () => requestHeaders.current,
}));

describe("rateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-08T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("limite kadar izin verir, sonrasını engeller", () => {
    const key = "test:izin-ver";
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);
    expect(rateLimit(key, 3, 60_000).ok).toBe(true);

    const blocked = rateLimit(key, 3, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.retryAfterSec).toBeLessThanOrEqual(60);
  });

  it("pencere dolunca sayaç sıfırlanır", () => {
    const key = "test:sifirla";
    expect(rateLimit(key, 1, 1_000).ok).toBe(true);
    expect(rateLimit(key, 1, 1_000).ok).toBe(false);

    vi.advanceTimersByTime(1_001);
    expect(rateLimit(key, 1, 1_000).ok).toBe(true);
  });

  it("farklı anahtarlar birbirini etkilemez", () => {
    expect(rateLimit("test:a", 1, 60_000).ok).toBe(true);
    expect(rateLimit("test:b", 1, 60_000).ok).toBe(true);
    expect(rateLimit("test:a", 1, 60_000).ok).toBe(false);
  });
});

describe("clientIp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    requestHeaders.current = new Headers();
  });

  it("TRUST_PROXY kapalıyken istemci başlıklarına güvenmez", async () => {
    vi.stubEnv("TRUST_PROXY", "false");
    requestHeaders.current = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" });
    expect(await clientIp()).toBe("local");
  });

  it("sahte baştaki XFF değeri IP'yi değiştirmez; vekilin eklediği son değer kullanılır", async () => {
    vi.stubEnv("TRUST_PROXY", "true");
    requestHeaders.current = new Headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.9" });
    expect(await clientIp()).toBe("203.0.113.9");

    requestHeaders.current = new Headers({ "x-forwarded-for": "7.7.7.7, 203.0.113.9" });
    expect(await clientIp()).toBe("203.0.113.9");
  });

  it("güvenilen vekilde XFF yoksa x-real-ip, o da yoksa local kullanılır", async () => {
    vi.stubEnv("TRUST_PROXY", "true");
    requestHeaders.current = new Headers({ "x-real-ip": "198.51.100.4" });
    expect(await clientIp()).toBe("198.51.100.4");

    requestHeaders.current = new Headers();
    expect(await clientIp()).toBe("local");
  });
});
