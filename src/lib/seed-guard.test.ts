import { describe, expect, it } from "vitest";
import { PUBLISHED_EXAMPLE_ADMIN_PASSWORD, seedProblem } from "./seed-guard";

describe("seedProblem", () => {
  it("geliştirme ortamında kendi parolasıyla çalışmasına izin verir", () => {
    expect(seedProblem({ NODE_ENV: "development", SEED_ADMIN_PASSWORD: "Benim-Parolam-1" })).toBeNull();
  });

  it("NODE_ENV tanımsızken de çalışmasına izin verir", () => {
    expect(seedProblem({ SEED_ADMIN_PASSWORD: "Benim-Parolam-1" })).toBeNull();
  });

  it("üretimde opt-in olmadan çalışmayı reddeder", () => {
    expect(seedProblem({ NODE_ENV: "production", SEED_ADMIN_PASSWORD: "Benim-Parolam-1" })).toMatch(
      /üretim ortamında/,
    );
  });

  it("üretimde SEED_ALLOW_PRODUCTION=true ile izin verir", () => {
    expect(
      seedProblem({
        NODE_ENV: "production",
        SEED_ALLOW_PRODUCTION: "true",
        SEED_ADMIN_PASSWORD: "Benim-Parolam-1",
      }),
    ).toBeNull();
  });

  it("yayımlanmış örnek parolayı geliştirmede kabul eder, üretimde reddeder", () => {
    expect(seedProblem({ NODE_ENV: "development", SEED_ADMIN_PASSWORD: PUBLISHED_EXAMPLE_ADMIN_PASSWORD })).toBeNull();
    expect(
      seedProblem({
        NODE_ENV: "production",
        SEED_ALLOW_PRODUCTION: "true",
        SEED_ADMIN_PASSWORD: PUBLISHED_EXAMPLE_ADMIN_PASSWORD,
      }),
    ).toMatch(/örnek dosyadaki/);
  });
});
