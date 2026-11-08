import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimit } from "./rate-limit";

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
