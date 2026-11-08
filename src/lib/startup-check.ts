// Uygulama başlarken çalışan yapılandırma denetimi (spec §5.2). Saf fonksiyon: yalnızca verilen
// ortam değişkenlerine bakar, bu yüzden birim testle sınanır. `src/instrumentation.ts` sorun
// bulunduğunda hata fırlatır ve sunucu başlamaz.

export interface StartupEnv {
  NODE_ENV?: string;
  VERIFIER_PROVIDER?: string;
}

export const MOCK_PROVIDER_IN_PRODUCTION =
  "VERIFIER_PROVIDER=mock üretim ortamında kullanılamaz; VERIFIER_PROVIDER=deepseek ve DEEPSEEK_API_KEY ayarla. " +
  "(VERIFIER_PROVIDER=mock is not allowed in production; set VERIFIER_PROVIDER=deepseek and DEEPSEEK_API_KEY.)";

/**
 * Üretimde başlatmayı engelleyen bir yapılandırma sorunu varsa mesajını, yoksa null döndürür.
 * Sağlayıcı adı `getVerifierProvider` ile aynı biçimde (boşluk ve büyük/küçük harf yok sayılarak) okunur.
 */
export function productionConfigProblem(env: StartupEnv): string | null {
  if (env.NODE_ENV !== "production") return null;
  const provider = (env.VERIFIER_PROVIDER ?? "").trim().toLowerCase();
  if (provider === "mock") return MOCK_PROVIDER_IN_PRODUCTION;
  return null;
}
