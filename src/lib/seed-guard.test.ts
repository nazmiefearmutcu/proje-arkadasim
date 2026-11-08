import { describe, expect, it } from "vitest";
import {
  PUBLISHED_EXAMPLE_ADMIN_PASSWORD,
  PUBLISHED_EXAMPLE_USER_PASSWORD,
  SEED_WIPE_FLAG,
  seedProblem,
  seedWipeProblem,
} from "./seed-guard";

describe("seedProblem", () => {
  it("geliştirme ortamında kendi parolasıyla çalışmasına izin verir", () => {
    expect(seedProblem({ NODE_ENV: "development", SEED_ADMIN_PASSWORD: "Benim-Parolam-1" })).toBeNull();
  });

  it("NODE_ENV tanımsızken de çalışmasına izin verir (dolu veritabanını seedWipeProblem korur)", () => {
    expect(seedProblem({ SEED_ADMIN_PASSWORD: "Benim-Parolam-1" })).toBeNull();
  });

  it("üretimde opt-in olmadan çalışmayı reddeder", () => {
    expect(seedProblem({ NODE_ENV: "production", SEED_ADMIN_PASSWORD: "Benim-Parolam-1" })).toMatch(
      /üretim ortamında/,
    );
  });

  it("üretimde SEED_ALLOW_PRODUCTION=true ile kendi parolalarıyla izin verir", () => {
    expect(
      seedProblem({
        NODE_ENV: "production",
        SEED_ALLOW_PRODUCTION: "true",
        SEED_ADMIN_PASSWORD: "Benim-Parolam-1",
        SEED_USER_PASSWORD: "Kullanici-Parolam-2",
      }),
    ).toBeNull();
  });

  it("yayımlanmış örnek yönetici parolasını geliştirmede kabul eder, üretimde reddeder", () => {
    expect(seedProblem({ NODE_ENV: "development", SEED_ADMIN_PASSWORD: PUBLISHED_EXAMPLE_ADMIN_PASSWORD })).toBeNull();
    expect(
      seedProblem({
        NODE_ENV: "production",
        SEED_ALLOW_PRODUCTION: "true",
        SEED_ADMIN_PASSWORD: PUBLISHED_EXAMPLE_ADMIN_PASSWORD,
        SEED_USER_PASSWORD: "Kullanici-Parolam-2",
      }),
    ).toMatch(/SEED_ADMIN_PASSWORD örnek dosyadaki/);
  });

  it("yayımlanmış örnek kullanıcı parolasını geliştirmede kabul eder, üretimde reddeder", () => {
    expect(
      seedProblem({
        NODE_ENV: "development",
        SEED_ADMIN_PASSWORD: PUBLISHED_EXAMPLE_ADMIN_PASSWORD,
        SEED_USER_PASSWORD: PUBLISHED_EXAMPLE_USER_PASSWORD,
      }),
    ).toBeNull();
    expect(
      seedProblem({
        NODE_ENV: "production",
        SEED_ALLOW_PRODUCTION: "true",
        SEED_ADMIN_PASSWORD: "Benim-Parolam-1",
        SEED_USER_PASSWORD: PUBLISHED_EXAMPLE_USER_PASSWORD,
      }),
    ).toMatch(/SEED_USER_PASSWORD örnek dosyadaki/);
  });
});

describe("seedWipeProblem", () => {
  it("boş veritabanında bayraksız çalışır (prisma migrate reset tohumu)", () => {
    expect(seedWipeProblem(0, [])).toBeNull();
  });

  it("veritabanında kullanıcı varsa bayraksız durur ve --wipe ile make-admin yolunu söyler", () => {
    const problem = seedWipeProblem(3, []);
    expect(problem).toMatch(/3 kullanıcı var/);
    expect(problem).toContain("npm run seed -- --wipe");
    expect(problem).toContain("npm run make-admin -- <e-posta>");
  });

  it("veritabanında kullanıcı varsa --wipe ile çalışır", () => {
    expect(seedWipeProblem(18, [SEED_WIPE_FLAG])).toBeNull();
    expect(seedWipeProblem(18, ["--baska", "--wipe"])).toBeNull();
  });

  it("benzer ama farklı bayrakları kabul etmez", () => {
    expect(seedWipeProblem(1, ["--wip"])).not.toBeNull();
    expect(seedWipeProblem(1, ["wipe"])).not.toBeNull();
  });
});
