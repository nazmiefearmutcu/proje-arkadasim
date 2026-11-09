import { createDeepSeekProvider, createOpenAiProvider } from "./deepseek";
import { createMockProvider } from "./mock";
import type { VerifierProvider } from "./types";

export { AiAnalysisSchema, VerifierError, DOCUMENT_TYPES } from "./types";
export type { AiAnalysis, VerifierInput, VerifierProvider } from "./types";
export { createMockProvider } from "./mock";
export { buildDeepSeekRequest, buildOpenAiRequest, createDeepSeekProvider, createOpenAiProvider } from "./deepseek";

const DEFAULT_OPENAI_MODEL = "gpt-5.6-luna";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-flash";
const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";

/**
 * Ortam değişkenlerine göre sağlayıcıyı seçer.
 * - VERIFIER_PROVIDER=mock: yalnız NODE_ENV !== "production" iken; üretimde hata verir.
 * - VERIFIER_PROVIDER boş ya da "openai" (varsayılan): OPENAI_API_KEY varsa OpenAI, yoksa null.
 * - VERIFIER_PROVIDER "deepseek": DEEPSEEK_API_KEY varsa DeepSeek, yoksa null. Rıza metni OpenAI'yi
 *   adlandırdığı için DeepSeek seçilirse src/config/legal.ts içindeki AI_PROVIDER da değiştirilmelidir.
 * - Tanınmayan değer: null (güvenli taraf; otomatik onay yok).
 */
export function getVerifierProvider(): VerifierProvider | null {
  const choice = (process.env.VERIFIER_PROVIDER ?? "openai").trim().toLowerCase();

  if (choice === "mock") {
    if (process.env.NODE_ENV === "production") {
      throw new Error("VERIFIER_PROVIDER=mock üretim ortamında kullanılamaz.");
    }
    return createMockProvider();
  }

  if (choice === "openai" || choice === "") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;
    return createOpenAiProvider({
      apiKey,
      model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      baseURL: process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL,
    });
  }

  if (choice === "deepseek") {
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
