import { afterEach, describe, expect, it, vi } from "vitest";
import { register } from "@/instrumentation";
import { MOCK_PROVIDER_IN_PRODUCTION, productionConfigProblem } from "./startup-check";

describe("productionConfigProblem", () => {
  it("üretimde mock sağlayıcı için mesaj döndürür", () => {
    expect(productionConfigProblem({ NODE_ENV: "production", VERIFIER_PROVIDER: "mock" })).toBe(
      MOCK_PROVIDER_IN_PRODUCTION,
    );
  });

  it("geliştirmede ve testte mock sağlayıcıya izin verir", () => {
    expect(productionConfigProblem({ NODE_ENV: "development", VERIFIER_PROVIDER: "mock" })).toBeNull();
    expect(productionConfigProblem({ NODE_ENV: "test", VERIFIER_PROVIDER: "mock" })).toBeNull();
    expect(productionConfigProblem({ VERIFIER_PROVIDER: "mock" })).toBeNull();
  });

  it("üretimde deepseek, boş ya da tanımsız sağlayıcı sorun sayılmaz", () => {
    expect(productionConfigProblem({ NODE_ENV: "production", VERIFIER_PROVIDER: "deepseek" })).toBeNull();
    expect(productionConfigProblem({ NODE_ENV: "production", VERIFIER_PROVIDER: "" })).toBeNull();
    expect(productionConfigProblem({ NODE_ENV: "production" })).toBeNull();
  });

  it("büyük/küçük harf ve boşluk varyantlarını da yakalar", () => {
    for (const value of ["MOCK", "Mock", " mock ", "\tmock\n"]) {
      expect(productionConfigProblem({ NODE_ENV: "production", VERIFIER_PROVIDER: value }), value).toBe(
        MOCK_PROVIDER_IN_PRODUCTION,
      );
    }
  });

  it("mesaj Türkçe ve İngilizce açıklama içerir", () => {
    expect(MOCK_PROVIDER_IN_PRODUCTION).toContain("üretim ortamında kullanılamaz");
    expect(MOCK_PROVIDER_IN_PRODUCTION).toContain("not allowed in production");
  });
});

describe("instrumentation register", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("Node çalışma zamanında üretim + mock ise başlatmayı durdurur", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERIFIER_PROVIDER", "mock");
    await expect(register()).rejects.toThrow(MOCK_PROVIDER_IN_PRODUCTION);
  });

  it("geçerli yapılandırmada ve edge çalışma zamanında sessizce döner", async () => {
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERIFIER_PROVIDER", "deepseek");
    await expect(register()).resolves.toBeUndefined();

    vi.stubEnv("NEXT_RUNTIME", "edge");
    vi.stubEnv("VERIFIER_PROVIDER", "mock");
    await expect(register()).resolves.toBeUndefined();
  });
});
