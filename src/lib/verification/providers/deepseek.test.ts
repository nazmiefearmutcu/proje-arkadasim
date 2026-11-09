import { afterEach, describe, expect, it, vi } from "vitest";
import { maskDocumentText } from "../mask";
import { buildDeepSeekRequest, buildOpenAiRequest, createDeepSeekProvider, createOpenAiProvider, MIN_RETRY_BUDGET_MS, TIMEOUT_MS } from "./deepseek";
import type { CompletionFn } from "./deepseek";
import { VerifierError } from "./types";
import type { VerifierInput } from "./types";

const SAMPLE = `T.C.
ÖĞRENCİ BELGESİ
T.C. Kimlik No : 10000000146
Adı Soyadı : AYŞE NUR KILIÇ
Baba Adı : MEHMET
Doğum Yeri : KONYA
Doğum Tarihi : 01.02.2003
Üniversite : ORTA DOĞU TEKNİK ÜNİVERSİTESİ
Program : BİLGİSAYAR MÜHENDİSLİĞİ (İNGİLİZCE)
Öğrenim Düzeyi : LİSANS
Sınıf : 3
Öğrenci No : 2345678
Belge Doğrulama Kodu : ABC1-DEF2-GHI3
Barkod No : YOK-2026-ABCDEF12345
İletişim: ogrenci@example.com 0 (532) 123 45 67
Belge Tarihi : 01.11.2026`;

const FORBIDDEN = [
  "10000000146",
  "AYŞE",
  "NUR",
  "KILIÇ",
  "MEHMET",
  "KONYA",
  "01.02.2003",
  "2345678",
  "ABC1-DEF2-GHI3",
  "YOK-2026-ABCDEF12345",
  "ogrenci@example.com",
  "532",
];

function sampleInput(): VerifierInput {
  const { masked } = maskDocumentText(SAMPLE, { firstName: "Ayşe Nur", lastName: "Kılıç" });
  return {
    maskedText: masked,
    signals: { source: "PDF_TEXT", pdf: { producer: "Test", creator: null, createdAt: null, modifiedAt: null, incrementalUpdates: 0, pageCount: 1 } },
    today: "2026-11-08",
  };
}

const VALID_ANALYSIS = {
  isEducationDocument: true,
  documentType: "OGRENCI_BELGESI",
  academicStatus: "STUDENT",
  institution: "ORTA DOĞU TEKNİK ÜNİVERSİTESİ",
  isTurkishHigherEducation: true,
  faculty: null,
  department: "BİLGİSAYAR MÜHENDİSLİĞİ",
  degreeLevel: "LISANS",
  classYear: 3,
  graduationYear: null,
  issueDate: "2026-11-01",
  issuer: "E_DEVLET",
  redFlags: [],
  confidence: 0.9,
  summary: "Tutarlı öğrenci belgesi.",
};

function reply(content: string | null) {
  return { choices: [{ message: { content } }] };
}

describe("buildDeepSeekRequest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("json_object yanıt biçimini ve 'json' kelimesini içerir", () => {
    const params = buildDeepSeekRequest(sampleInput(), "deepseek-flash");
    expect(params.response_format).toEqual({ type: "json_object" });
    expect(params.temperature).toBe(0);
    expect(params.max_tokens).toBe(800);
    expect(params.model).toBe("deepseek-flash");
    expect(JSON.stringify(params)).toContain("json");
  });

  it("maskelenmiş örnekten üretilen istekte yasak değerler bulunmaz", () => {
    const serialized = JSON.stringify(buildDeepSeekRequest(sampleInput(), "deepseek-flash"));
    for (const forbidden of FORBIDDEN) {
      expect(serialized, `içermemeli: ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("DEEPSEEK_THINKING ayarlıysa thinking alanını ekler, değilse eklemez", () => {
    vi.stubEnv("DEEPSEEK_THINKING", "disabled");
    expect(buildDeepSeekRequest(sampleInput(), "m").thinking).toEqual({ type: "disabled" });
    vi.stubEnv("DEEPSEEK_THINKING", "bogus");
    expect(buildDeepSeekRequest(sampleInput(), "m").thinking).toBeUndefined();
  });
});

describe("buildOpenAiRequest", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("GPT-5 ailesine uygun gövde kurar: sıcaklık ve max_tokens yok, json yanıt, düşük akıl yürütme", () => {
    const params = buildOpenAiRequest(sampleInput(), "gpt-5.6-luna");
    expect(params.model).toBe("gpt-5.6-luna");
    expect(params).not.toHaveProperty("temperature");
    expect(params).not.toHaveProperty("max_tokens");
    expect(params.max_completion_tokens).toBeGreaterThan(0);
    expect(params.response_format).toEqual({ type: "json_object" });
    expect(params.reasoning_effort).toBe("low");
  });

  it("geçersiz OPENAI_REASONING_EFFORT gönderilmez", () => {
    vi.stubEnv("OPENAI_REASONING_EFFORT", "turbo");
    expect(buildOpenAiRequest(sampleInput(), "m").reasoning_effort).toBeUndefined();
  });

  it("OpenAI sağlayıcısı aynı doğrulama yolunu kullanır ve adını openai olarak bildirir", async () => {
    let sent: unknown;
    const provider = createOpenAiProvider({
      apiKey: "k",
      model: "gpt-5.6-luna",
      baseURL: "https://x",
      createCompletion: async (params) => {
        sent = params;
        return { choices: [{ message: { content: JSON.stringify(VALID_ANALYSIS) } }] };
      },
    });
    expect(provider.name).toBe("openai");
    await expect(provider.analyze(sampleInput())).resolves.toBeTruthy();
    expect(sent).toMatchObject({ model: "gpt-5.6-luna", max_completion_tokens: expect.any(Number) });
  });
});

describe("createDeepSeekProvider.analyze", () => {
  it("geçerli JSON'u ayrıştırıp döndürür", async () => {
    const create = vi.fn<CompletionFn>(async () => reply(JSON.stringify(VALID_ANALYSIS)));
    const provider = createDeepSeekProvider({ apiKey: "k", model: "deepseek-flash", baseURL: "https://x", createCompletion: create });
    const result = await provider.analyze(sampleInput());
    expect(result.documentType).toBe("OGRENCI_BELGESI");
    expect(result.confidence).toBe(0.9);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("boş içerikten sonra tekrar dener ve ikinci yanıtı kullanır", async () => {
    const create = vi
      .fn<CompletionFn>()
      .mockResolvedValueOnce(reply("   "))
      .mockResolvedValueOnce(reply(JSON.stringify(VALID_ANALYSIS)));
    const provider = createDeepSeekProvider({ apiKey: "k", model: "m", baseURL: "https://x", createCompletion: create });
    const result = await provider.analyze(sampleInput());
    expect(result.confidence).toBe(0.9);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("iki kez boş içerik gelirse VerifierError fırlatır", async () => {
    const create = vi.fn<CompletionFn>(async () => reply(null));
    const provider = createDeepSeekProvider({ apiKey: "k", model: "m", baseURL: "https://x", createCompletion: create });
    await expect(provider.analyze(sampleInput())).rejects.toBeInstanceOf(VerifierError);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it("geçersiz JSON için VerifierError fırlatır", async () => {
    const create = vi.fn<CompletionFn>(async () => reply("{bu json degil"));
    const provider = createDeepSeekProvider({ apiKey: "k", model: "m", baseURL: "https://x", createCompletion: create });
    await expect(provider.analyze(sampleInput())).rejects.toBeInstanceOf(VerifierError);
  });

  it("şema uyuşmazlığında VerifierError fırlatır", async () => {
    const create = vi.fn<CompletionFn>(async () => reply(JSON.stringify({ ...VALID_ANALYSIS, confidence: 5 })));
    const provider = createDeepSeekProvider({ apiKey: "k", model: "m", baseURL: "https://x", createCompletion: create });
    await expect(provider.analyze(sampleInput())).rejects.toBeInstanceOf(VerifierError);
  });

  it("boş içerikten sonra kalan süre yetmiyorsa tekrar denemez", async () => {
    const create = vi.fn<CompletionFn>(async () => reply(""));
    const provider = createDeepSeekProvider({
      apiKey: "k",
      model: "m",
      baseURL: "https://x",
      createCompletion: create,
      timeoutMs: MIN_RETRY_BUDGET_MS - 1,
    });
    await expect(provider.analyze(sampleInput())).rejects.toBeInstanceOf(VerifierError);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("her isteğe kalan süreyi ve ortak iptal sinyalini verir", async () => {
    const create = vi
      .fn<CompletionFn>()
      .mockResolvedValueOnce(reply(null))
      .mockResolvedValueOnce(reply(JSON.stringify(VALID_ANALYSIS)));
    const provider = createDeepSeekProvider({ apiKey: "k", model: "m", baseURL: "https://x", createCompletion: create });
    await provider.analyze(sampleInput());
    const [first, second] = create.mock.calls.map((call) => call[1]);
    expect(first.timeoutMs).toBeLessThanOrEqual(TIMEOUT_MS);
    expect(first.timeoutMs).toBeGreaterThan(TIMEOUT_MS - 1_000);
    expect(second.timeoutMs).toBeLessThanOrEqual(first.timeoutMs);
    expect(first.signal).toBe(second.signal);
    expect(first.signal.aborted).toBe(false);
  });

  it("ağ hatasını VerifierError'a çevirir, ayrıntıyı taşımaz", async () => {
    const create = vi.fn<CompletionFn>(async () => {
      throw new Error("ağ ayrıntısı");
    });
    const provider = createDeepSeekProvider({ apiKey: "k", model: "m", baseURL: "https://x", createCompletion: create });
    const error = await provider.analyze(sampleInput()).catch((err: unknown) => err);
    expect(error).toBeInstanceOf(VerifierError);
    expect((error as Error).message).not.toContain("ağ ayrıntısı");
  });
});

// Gerçek OpenAI istemci yolu: sahte fetch ile istemci ayarları (zaman aşımı, tekrar sayısı) da sınanır
// (spec §10: boş içerik, geçersiz JSON, zaman aşımı).
describe("createDeepSeekProvider gerçek istemciyle (sahte HTTP)", () => {
  const BASE_URL = "https://deepseek.test";

  function completionResponse(content: string | null, status = 200): Response {
    return new Response(
      JSON.stringify({
        id: "cmpl-test",
        object: "chat.completion",
        created: 0,
        model: "deepseek-flash",
        choices: [{ index: 0, finish_reason: "stop", message: { role: "assistant", content } }],
      }),
      { status, headers: { "content-type": "application/json" } },
    );
  }

  function providerWith(fetchImpl: typeof fetch, timeoutMs = 10_000) {
    return createDeepSeekProvider({
      apiKey: "test-key",
      model: "deepseek-flash",
      baseURL: BASE_URL,
      fetch: fetchImpl,
      timeoutMs,
    });
  }

  it("geçerli yanıtı ayrıştırır; gövde maskeli metni taşır, kişisel veri taşımaz", async () => {
    const fetchSpy = vi.fn<typeof fetch>(async () => completionResponse(JSON.stringify(VALID_ANALYSIS)));

    const result = await providerWith(fetchSpy).analyze(sampleInput());

    expect(result.confidence).toBe(0.9);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toBe(`${BASE_URL}/chat/completions`);
    const body = String(init?.body);
    expect(JSON.parse(body)).toMatchObject({ model: "deepseek-flash", response_format: { type: "json_object" } });
    for (const forbidden of FORBIDDEN) {
      expect(body, `içermemeli: ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("yanıt vermeyen ama iptal sinyaline uyan fetch, üst süre içinde VerifierError ile biter ve tekrar edilmez", async () => {
    const fetchSpy = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    const started = Date.now();

    await expect(providerWith(fetchSpy, 100).analyze(sampleInput())).rejects.toBeInstanceOf(VerifierError);

    expect(Date.now() - started).toBeLessThan(2_000);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("iptal sinyalini yok sayan fetch'te de üst süre dolunca VerifierError döner", async () => {
    const fetchSpy = vi.fn<typeof fetch>(() => new Promise<Response>(() => {}));
    const started = Date.now();

    await expect(providerWith(fetchSpy, 100).analyze(sampleInput())).rejects.toBeInstanceOf(VerifierError);

    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("iki kez boş içerik gelirse iki istekten sonra VerifierError fırlatır", async () => {
    const fetchSpy = vi.fn<typeof fetch>(async () => completionResponse(""));

    await expect(providerWith(fetchSpy).analyze(sampleInput())).rejects.toBeInstanceOf(VerifierError);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("geçersiz JSON içerikte VerifierError fırlatır", async () => {
    const fetchSpy = vi.fn<typeof fetch>(async () => completionResponse("{bu json degil"));

    await expect(providerWith(fetchSpy).analyze(sampleInput())).rejects.toBeInstanceOf(VerifierError);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("sunucu hatasını SDK tekrar etmez, VerifierError'a çevirir", async () => {
    const fetchSpy = vi.fn<typeof fetch>(
      async () =>
        new Response(JSON.stringify({ error: { message: "iç ayrıntı" } }), {
          status: 500,
          headers: { "content-type": "application/json" },
        }),
    );

    const error = await providerWith(fetchSpy).analyze(sampleInput()).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(VerifierError);
    expect((error as Error).message).not.toContain("iç ayrıntı");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
