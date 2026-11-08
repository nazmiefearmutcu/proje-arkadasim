import { createDeepSeekProvider } from "./deepseek";
import { createMockProvider } from "./mock";
import type { VerifierProvider } from "./types";

export { AiAnalysisSchema, VerifierError, DOCUMENT_TYPES } from "./types";
export type { AiAnalysis, VerifierInput, VerifierProvider } from "./types";
export { createMockProvider } from "./mock";
export { buildDeepSeekRequest, createDeepSeekProvider } from "./deepseek";

const DEFAULT_DEEPSEEK_MODEL = "deepseek-flash";
const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";

/**
 * Ortam değişkenlerine göre sağlayıcıyı seçer.
 * - VERIFIER_PROVIDER=mock: yalnız NODE_ENV !== "production" iken; üretimde hata verir.
 * - VERIFIER_PROVIDER boş ya da "deepseek": DEEPSEEK_API_KEY varsa DeepSeek, yoksa null.
 * - Tanınmayan değer: null (güvenli taraf; otomatik onay yok).
 */
export function getVerifierProvider(): VerifierProvider | null {
  const choice = (process.env.VERIFIER_PROVIDER ?? "deepseek").trim().toLowerCase();

  if (choice === "mock") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("VERIFIER_PROVIDER=mock üretim ortamında kullanılamaz.");
    }
    return createMockProvider();
  }

  if (choice === "deepseek" || choice === "") {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return null;
    return createDeepSeekProvider({
      apiKey,
      model: process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
      baseURL: process.env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL,
    });
  }

  return null;
}
