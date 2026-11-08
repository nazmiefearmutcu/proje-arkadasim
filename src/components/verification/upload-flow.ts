// Belge yükleyicinin tarayıcıdan bağımsız parçaları: adım listesi, yanıt okuma, yenileme kararı ve
// zaman aşımlı gönderim. Ayrı dosyada tutulur; böylece bileşen olmadan birim testi yapılabilir.

export const GENERIC_ERROR_MESSAGE = "Belge şu an işlenemedi. Birazdan tekrar dene.";

/** Sunucu hiç yanıt vermezse (ör. OCR dil verisine ulaşılamazsa) istek bu süre sonunda kesilir. */
export const UPLOAD_TIMEOUT_MS = 90_000;

// Spec §4.2'deki adım listesi rızalı akışı anlatır. Yapay zeka rızası yoksa hizmet yapay zekayı hiç
// çağırmaz (spec §5.1 adım 6); bu yüzden üçüncü adım o durumda ekibin incelemesini söyler.
const STEPS_WITH_AI = [
  "Belge okunuyor",
  "Kişisel veriler maskeleniyor",
  "Yapay zeka inceliyor",
  "Sonuç",
] as const;
const STEPS_WITHOUT_AI = [
  "Belge okunuyor",
  "Kişisel veriler maskeleniyor",
  "Ekibimizin incelemesine hazırlanıyor",
  "Sonuç",
] as const;

export const LAST_STEP = STEPS_WITH_AI.length - 1;

export function stepsFor(aiConsent: boolean): readonly string[] {
  return aiConsent ? STEPS_WITH_AI : STEPS_WITHOUT_AI;
}

export interface UploadResult {
  status: string;
  message: string;
  consumedAttempt: boolean;
}

const GENERIC_RESULT: UploadResult = {
  status: "ERROR",
  message: GENERIC_ERROR_MESSAGE,
  consumedAttempt: false,
};

/** `/api/verification` yanıtını okur. Beklenmeyen gövde genel hata olur. */
export function readUploadResult(data: unknown): UploadResult {
  if (typeof data !== "object" || data === null) return GENERIC_RESULT;
  const record = data as Record<string, unknown>;
  const message =
    typeof record.message === "string"
      ? record.message
      : typeof record.error === "string"
        ? record.error
        : GENERIC_ERROR_MESSAGE;
  return {
    status: typeof record.status === "string" ? record.status : "ERROR",
    message,
    consumedAttempt: record.consumedAttempt === true,
  };
}

/**
 * Sonuçtan sonra sayfa sunucudan yenilenmeli mi? Deneme hakkı yenen her sonuçta (onay, ret, manuel
 * inceleme) evet: durum kartı ve kalan deneme sayısı güncellenir. Zaten doğrulanmış hesapta (eski sekme,
 * APPROVED ama hak yenmedi) da evet.
 */
export function shouldRefreshAfter(result: UploadResult): boolean {
  return result.consumedAttempt || result.status === "APPROVED";
}

export type SendOutcome = { kind: "result"; result: UploadResult } | { kind: "aborted" };

/**
 * Belgeyi gönderir. `timeoutMs` içinde yanıt gelmezse istek kesilir. Çağıran `controller`'ı başka bir
 * nedenle (bileşen kapandı) de kesebilir; her iki durumda "aborted" döner. Zaman aşımı sayacı her
 * durumda temizlenir. Ağ hatası genel hata sonucu olur.
 */
export async function postDocument(
  body: FormData,
  options: { controller: AbortController; timeoutMs?: number; fetchImpl?: typeof fetch },
): Promise<SendOutcome> {
  const { controller, timeoutMs = UPLOAD_TIMEOUT_MS } = options;
  const doFetch = options.fetchImpl ?? fetch;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let result = GENERIC_RESULT;
  try {
    const response = await doFetch("/api/verification", {
      method: "POST",
      body,
      signal: controller.signal,
    });
    const data: unknown = await response.json().catch(() => null);
    result = readUploadResult(data);
  } catch {
    // Ağ hatası ya da kesilen istek.
  } finally {
    clearTimeout(timer);
  }

  return controller.signal.aborted ? { kind: "aborted" } : { kind: "result", result };
}
