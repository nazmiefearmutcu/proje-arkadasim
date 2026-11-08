import OpenAI from "openai";
import { AiAnalysisSchema, VerifierError } from "./types";
import type { AiAnalysis, VerifierInput, VerifierProvider } from "./types";

const MAX_TOKENS = 800;
const TIMEOUT_MS = 20_000;
const MAX_RETRIES = 1;

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

export type CompletionFn = (params: DeepSeekRequest) => Promise<CompletionResponse>;

/** İstek gövdesini kurar. Yalnızca maskelenmiş metin ve kişisel olmayan sinyaller içerir. */
export function buildDeepSeekRequest(input: VerifierInput, model: string): DeepSeekRequest {
  const request: DeepSeekRequest = {
    model,
    temperature: 0,
    max_tokens: MAX_TOKENS,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          belgeMetni: input.maskedText,
          sinyaller: input.signals,
          bugun: input.today,
        }),
      },
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
}

function clientCompletion(options: DeepSeekOptions): CompletionFn {
  const client = new OpenAI({
    apiKey: options.apiKey,
    baseURL: options.baseURL,
    timeout: TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
  });
  return (params) => client.chat.completions.create(params);
}

/** Boş ya da yalnız boşluktan oluşan içerikte null döner. Hata ayrıntısı içermez. */
async function requestContent(complete: CompletionFn, params: DeepSeekRequest): Promise<string | null> {
  let response: CompletionResponse;
  try {
    response = await complete(params);
  } catch {
    throw new VerifierError("Sağlayıcı isteği başarısız oldu.");
  }
  const content = response.choices[0]?.message.content;
  if (typeof content !== "string" || content.trim().length === 0) return null;
  return content;
}

export function createDeepSeekProvider(options: DeepSeekOptions): VerifierProvider {
  const complete = options.createCompletion ?? clientCompletion(options);

  return {
    name: "deepseek",
    model: options.model,
    async analyze(input: VerifierInput): Promise<AiAnalysis> {
      const params = buildDeepSeekRequest(input, options.model);

      // Boş içerikte bir kez daha dene (spec §5.1 adım 6).
      let content = await requestContent(complete, params);
      if (content === null) content = await requestContent(complete, params);
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
