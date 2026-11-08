import { afterEach, describe, expect, it, vi } from "vitest";
import { maskDocumentText } from "../mask";
import { buildDeepSeekRequest, createDeepSeekProvider } from "./deepseek";
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
