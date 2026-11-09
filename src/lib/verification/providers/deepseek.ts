import OpenAI from "openai";
import { AiAnalysisSchema, VerifierError } from "./types";
import type { AiAnalysis, VerifierInput, VerifierProvider } from "./types";

const MAX_TOKENS = 800;
const OPENAI_MAX_COMPLETION_TOKENS = 4000;
/** Bir analizin toplam üst süresi (spec §5.1 adım 6): boş içerik tekrarı da bu sürenin içindedir. */
export const TIMEOUT_MS = 20_000;
/** Boş içerikten sonra tekrar için gereken en az kalan süre; daha azsa tekrar denenmez. */
export const MIN_RETRY_BUDGET_MS = 2_000;

const SCHEMA_EXAMPLE = `{
  "isEducationDocument": true,
  "documentType": "OGRENCI_BELGESI | MEZUN_BELGESI | DIPLOMA | TRANSKRIPT | DIGER",
  "academicStatus": "STUDENT | GRADUATE | UNKNOWN",
  "institution": "string|null",
  "isTurkishHigherEducation": true,
  "faculty": "string|null",
  "department": "string|null",
  "degreeLevel": "ONLISANS | LISANS | YUKSEK_LISANS | DOKTORA | UNKNOWN",
  "classYear": "number|null",
  "graduationYear": "number|null",
  "issueDate": "YYYY-MM-DD|null",
  "issuer": "E_DEVLET | YOK | UNIVERSITE | DIGER",
  "redFlags": ["string"],
  "confidence": 0.0,
  "summary": "kısa Türkçe gerekçe, kişisel veri içermez"
}`;

const SYSTEM_PROMPT = `Sen Türkiye'deki yükseköğretim belgelerini inceleyen bir doğrulama asistanısın.
Gelen belge metni maskelenmiştir: [AD], [SOYAD], [AD SOYAD], [TCKN], [GİZLİ] ve [NUMARA] gibi
etiketler kişisel verilerin yerine konmuştur. Maskelenmiş alanları asla tahmin etme.

Görevin:
1. Belgenin bir öğrenci belgesi, mezun belgesi, diploma veya transkript olup olmadığını belirle.
   Türkiye'deki bir yükseköğretim kurumuna ait olup olmadığını değerlendir.
2. Eğitim alanlarını (kurum, fakülte, bölüm, derece, sınıf, mezuniyet yılı, tarih) çıkar.
   Bulunmayan alanlar için null yaz.
3. Tutarsız tarihler, var olmayan kurum veya bölüm, belge türüyle uyuşmayan içerik ve PDF
   sinyallerindeki düzenleme izleri (üretici uyuşmazlığı, artımlı güncellemeler) gibi kırmızı
   bayrakları redFlags alanına yaz (en fazla 10).
4. confidence alanına 0 ile 1 arasında bir güven değeri yaz.

Yanıtı yalnızca json olarak ver. json dışında hiçbir metin ekleme. Şema örneği:
${SCHEMA_EXAMPLE}

summary alanı kişisel veri içermemeli.`;

/** Chat tamamlama isteğinin gövdesi. `thinking` yalnızca DEEPSEEK_THINKING ile eklenir. */
export interface DeepSeekRequest {
  model: string;
  temperature: 0;
  max_tokens: number;
  response_format: { type: "json_object" };
  messages: Array<{ role: "system" | "user"; content: string }>;
  thinking?: { type: "enabled" | "disabled" };
}

export interface CompletionResponse {
  choices: Array<{ message: { content: string | null } }>;
}

/** Tek isteğin kalan süresi ve analizin ortak iptal sinyali. */
export interface CompletionRequestOptions {
  timeoutMs: number;
  signal: AbortSignal;
}

/** OpenAI uyumlu herhangi bir sohbet tamamlama gövdesi (DeepSeek ya da OpenAI). */
export type ChatRequest = DeepSeekRequest | OpenAiRequest;

/** OpenAI GPT-5 ailesi gövdesi: sıcaklık yok, `max_completion_tokens` ve akıl yürütme düzeyi var. */
export interface OpenAiRequest {
  model: string;
  max_completion_tokens: number;
  reasoning_effort?: "minimal" | "low" | "medium" | "high";
  response_format: { type: "json_object" };
  messages: Array<{ role: "system" | "user"; content: string }>;
}

export type CompletionFn = (
  params: ChatRequest,
  request: CompletionRequestOptions,
) => Promise<CompletionResponse>;

/** Modele giden kullanıcı mesajı: yalnızca maskelenmiş metin ve kişisel olmayan sinyaller. */
function userMessage(input: VerifierInput): string {
  return JSON.stringify({ belgeMetni: input.maskedText, sinyaller: input.signals, bugun: input.today });
}

/** OpenAI isteği. Akıl yürütme belirteçleri de tamamlama sınırına sayıldığı için sınır daha geniştir. */
export function buildOpenAiRequest(input: VerifierInput, model: string): OpenAiRequest {
  const request: OpenAiRequest = {
    model,
    max_completion_tokens: OPENAI_MAX_COMPLETION_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage(input) },
    ],
  };
  const effort = process.env.OPENAI_REASONING_EFFORT?.trim() || "low";
  if (effort === "minimal" || effort === "low" || effort === "medium" || effort === "high") {
    request.reasoning_effort = effort;
  }
  return request;
}

/** İstek gövdesini kurar. Yalnızca maskelenmiş metin ve kişisel olmayan sinyaller içerir. */
export function buildDeepSeekRequest(input: VerifierInput, model: string): DeepSeekRequest {
  const request: DeepSeekRequest = {
    model,
    temperature: 0,
    max_tokens: MAX_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMessage(input) },
    ],
  };

  const thinking = process.env.DEEPSEEK_THINKING;
  if (thinking === "enabled" || thinking === "disabled") {
    request.thinking = { type: thinking };
  }
  return request;
}

export interface DeepSeekOptions {
  apiKey: string;
  model: string;
  baseURL: string;
  /** Test için: OpenAI istemcisi yerine kullanılacak tamamlama işlevi. */
  createCompletion?: CompletionFn;
  /** Test için: OpenAI istemcisinin kullanacağı fetch (gerçek istemci yolu sahte HTTP ile sınanır). */
  fetch?: typeof fetch;
  /** Test için: toplam üst süre (varsayılan TIMEOUT_MS). */
  timeoutMs?: number;
  /** Sağlayıcı adı (kayıtlarda görünür). Varsayılan "deepseek". */
  name?: string;
  /** İstek gövdesini kuran işlev. Varsayılan DeepSeek gövdesi. */
  buildRequest?: (input: VerifierInput, model: string) => ChatRequest;
}

function clientCompletion(options: DeepSeekOptions): CompletionFn {
  // SDK kendi tekrarını yapmaz (maxRetries 0): zaman aşımında tekrar, süreyi iki katına çıkarırdı.
  // Boş içerik tekrarı sağlayıcıda, ortak üst sürenin içinde yapılır.
  const client = new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
    timeout: options.timeoutMs ?? TIMEOUT_MS,
    maxRetries: 0,
    fetch: options.fetch,
  });
  return (params, request) =>
    client.chat.completions.create(params, {
      timeout: request.timeoutMs,
      signal: request.signal,
      maxRetries: 0,
    });
}

/** Boş ya da yalnız boşluktan oluşan içerikte null döner. Hata ayrıntısı içermez. */
async function requestContent(
  complete: CompletionFn,
  params: ChatRequest,
  request: CompletionRequestOptions,
): Promise<string | null> {
  let response: CompletionResponse;
  try {
    response = await complete(params, request);
  } catch {
    throw new VerifierError("Sağlayıcı isteği başarısız oldu.");
  }
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string" || content.trim().length === 0) return null;
  return content;
}

/** OpenAI (varsayılan model gpt-5.6-luna) sağlayıcısı: aynı istemci, zaman aşımı ve doğrulama yolu. */
export function createOpenAiProvider(options: Omit<DeepSeekOptions, "name" | "buildRequest">): VerifierProvider {
  return createDeepSeekProvider({ ...options, name: "openai", buildRequest: buildOpenAiRequest });
}

export function createDeepSeekProvider(options: DeepSeekOptions): VerifierProvider {
  const complete = options.createCompletion ?? clientCompletion(options);
  const timeoutMs = options.timeoutMs ?? TIMEOUT_MS;

  return {
    name: options.name ?? "deepseek",
    model: options.model,
    async analyze(input: VerifierInput): Promise<AiAnalysis> {
      const params = (options.buildRequest ?? buildDeepSeekRequest)(input, options.model);

      // Tek üst süre: her istek kalan süreyi alır; süre dolunca istek iptal edilir ve analiz biter.
      const deadline = Date.now() + timeoutMs;
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const expired = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new VerifierError("Sağlayıcı zaman aşımına uğradı."));
        }, timeoutMs);
      });
      expired.catch(() => {});
      const attempt = () =>
        Promise.race([
          requestContent(complete, params, {
            timeoutMs: Math.max(1, deadline - Date.now()),
            signal: controller.signal,
          }),
          expired,
        ]);

      let content: string | null;
      try {
        // Boş içerikte bir kez daha dene (spec §5.1 adım 6), yeterli süre kaldıysa.
        content = await attempt();
        if (content === null && deadline - Date.now() >= MIN_RETRY_BUDGET_MS) content = await attempt();
      } finally {
        clearTimeout(timer);
      }
      if (content === null) throw new VerifierError("Sağlayıcı boş yanıt döndü.");

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        throw new VerifierError("Sağlayıcı geçerli JSON döndürmedi.");
      }

      const result = AiAnalysisSchema.safeParse(parsed);
      if (!result.success) throw new VerifierError("Sağlayıcı yanıtı şemaya uymuyor.");
      return result.data;
    },
  };
}
