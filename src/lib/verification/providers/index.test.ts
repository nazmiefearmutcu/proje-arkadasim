import { afterEach, describe, expect, it, vi } from "vitest";
import { getVerifierProvider } from "./index";

// Sağlayıcı seçimi "yanlış yapılandırma asla otomatik onaya gitmez" kuralının kapısıdır.

describe("getVerifierProvider", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("üretimde mock seçilirse hata fırlatır", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERIFIER_PROVIDER", "mock");
    expect(() => getVerifierProvider()).toThrow(/üretim/);
  });

  it("üretimde büyük harfli ve boşluklu mock da hata fırlatır", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERIFIER_PROVIDER", " MOCK ");
    expect(() => getVerifierProvider()).toThrow();
  });

  it("geliştirmede mock sağlayıcıyı döndürür", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERIFIER_PROVIDER", "mock");
    expect(getVerifierProvider()?.name).toBe("mock");
  });

  it("deepseek seçili ama DEEPSEEK_API_KEY yoksa null döndürür", () => {
    vi.stubEnv("VERIFIER_PROVIDER", "deepseek");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    expect(getVerifierProvider()).toBeNull();
  });

  it("sağlayıcı boşsa ve anahtar yoksa null döndürür", () => {
    vi.stubEnv("VERIFIER_PROVIDER", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    expect(getVerifierProvider()).toBeNull();
  });

  it("anahtar varsa deepseek sağlayıcısını varsayılan modelle döndürür", () => {
    vi.stubEnv("VERIFIER_PROVIDER", "deepseek");
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.stubEnv("DEEPSEEK_MODEL", "");
    const provider = getVerifierProvider();
    expect(provider?.name).toBe("deepseek");
    expect(provider?.model).toBe("deepseek-flash");
  });

  it("sağlayıcı boşsa ve anahtar varsa deepseek döndürür, DEEPSEEK_MODEL'i kullanır", () => {
    vi.stubEnv("VERIFIER_PROVIDER", "");
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    vi.stubEnv("DEEPSEEK_MODEL", "deepseek-pro");
    const provider = getVerifierProvider();
    expect(provider?.name).toBe("deepseek");
    expect(provider?.model).toBe("deepseek-pro");
  });

  it("tanınmayan değer mock'a düşmez, null döndürür", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DEEPSEEK_API_KEY", "test-key");
    for (const value of ["openai", "mocks", "moc", "random"]) {
      vi.stubEnv("VERIFIER_PROVIDER", value);
      expect(getVerifierProvider(), value).toBeNull();
    }
  });
});
