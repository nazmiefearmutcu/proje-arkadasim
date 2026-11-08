import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DocumentTooLargeError,
  extractFromImage,
  extractFromPdf,
  MAX_PDF_PAGES,
  OCR_TIMEOUT_MS,
  OcrUnavailableError,
} from "./extract";

// tesseract.js taklit edilir: testler gerçek WASM çalışanı açmaz ve ağa çıkmaz.
const tesseract = vi.hoisted(() => ({ createWorker: vi.fn() }));
vi.mock("tesseract.js", () => ({ createWorker: tesseract.createWorker }));

async function buildPdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`Sayfa ${i + 1} OGRENCI BELGESI ORTA DOGU TEKNIK UNIVERSITESI`, { x: 50, y: 800, size: 11, font });
  }
  return doc.save();
}

function png(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(64);
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(buf.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  for (let i = 24; i < buf.length; i++) buf[i] = (i * 13) % 251;
  return buf;
}

function fakeWorker(result = { text: "OGRENCI BELGESI", confidence: 91 }) {
  return {
    recognize: vi.fn(async () => ({ data: result })),
    terminate: vi.fn(async () => undefined),
  };
}

describe("extractFromPdf", () => {
  it("sayfa sınırı içindeki PDF'in metnini ve sayfa sayısını çıkarır", async () => {
    const bytes = await buildPdf(MAX_PDF_PAGES);
    const original = bytes.slice();

    const { text, signals } = await extractFromPdf(bytes);

    expect(text).toContain("OGRENCI BELGESI");
    expect(signals.pageCount).toBe(MAX_PDF_PAGES);
    // Çağıranın dizisine dokunulmaz; sıfırlama servisin işidir.
    expect(Buffer.from(bytes).equals(Buffer.from(original))).toBe(true);
  });

  it("6 sayfalık PDF'i metin çıkarmadan DocumentTooLargeError ile reddeder", async () => {
    const bytes = await buildPdf(MAX_PDF_PAGES + 1);

    const error = await extractFromPdf(bytes).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(DocumentTooLargeError);
    expect((error as DocumentTooLargeError).kind).toBe("pdf-pages");
  });

  it("bozuk PDF'te hata fırlatır (servis bunu READ_FAILED'e çevirir)", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\nbozuk icerik");
    await expect(extractFromPdf(bytes)).rejects.toBeTruthy();
  });
});

describe("extractFromImage", () => {
  let dir: string;

  beforeEach(() => {
    tesseract.createWorker.mockReset();
    dir = mkdtempSync(path.join(os.tmpdir(), "tessdata-test-"));
    vi.stubEnv("TESSDATA_LANG_PATH", dir);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    rmSync(dir, { recursive: true, force: true });
  });

  function seedLanguages() {
    writeFileSync(path.join(dir, "tur.traineddata"), "tur");
    writeFileSync(path.join(dir, "eng.traineddata"), "eng");
  }

  it("yerel dil verisiyle çalışanı açar, sonucu döndürür ve çalışanı kapatır", async () => {
    seedLanguages();
    const worker = fakeWorker();
    tesseract.createWorker.mockResolvedValue(worker);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await extractFromImage(png(1200, 900));

    expect(result).toEqual({ text: "OGRENCI BELGESI", confidence: 91 });
    expect(fetchSpy).not.toHaveBeenCalled();
    const [langs, oem, options] = tesseract.createWorker.mock.calls[0];
    expect(langs).toEqual(["tur", "eng"]);
    expect(oem).toBe(1);
    expect(options).toMatchObject({ langPath: dir, cachePath: dir, gzip: false });
    expect(typeof options.errorHandler).toBe("function");
    expect(worker.terminate).toHaveBeenCalledTimes(1);

    // Tanımaya verilen tampon kopyası işlem sonunda sıfırlanır.
    const passed = worker.recognize.mock.calls[0] as unknown as [Buffer];
    expect(passed[0].every((byte) => byte === 0)).toBe(true);
  });

  it("çok büyük piksel boyutunda OCR başlamadan DocumentTooLargeError fırlatır", async () => {
    seedLanguages();
    for (const [width, height] of [
      [9000, 100],
      [100, 8001],
      [7000, 7000],
    ]) {
      const error = await extractFromImage(png(width, height)).catch((err: unknown) => err);
      expect(error, `${width}x${height}`).toBeInstanceOf(DocumentTooLargeError);
      expect((error as DocumentTooLargeError).kind).toBe("image-pixels");
    }
    expect(tesseract.createWorker).not.toHaveBeenCalled();
  });

  it("başlığı okunamayan görselde OCR başlamadan hata fırlatır", async () => {
    seedLanguages();
    const garbage = new Uint8Array(64);
    garbage.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const error = await extractFromImage(garbage).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(OcrUnavailableError);
    expect(tesseract.createWorker).not.toHaveBeenCalled();
  });

  it("createWorker hiç sonuçlanmazsa üst süre dolunca OcrUnavailableError ile reddeder", async () => {
    seedLanguages();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let markCalled: () => void = () => {};
    const called = new Promise<void>((resolve) => {
      markCalled = resolve;
    });
    tesseract.createWorker.mockImplementation(() => {
      markCalled();
      return new Promise(() => {});
    });

    const pending = extractFromImage(png(800, 600)).catch((err: unknown) => err);
    await called;
    await vi.advanceTimersByTimeAsync(OCR_TIMEOUT_MS - 1);
    let settled = false;
    void pending.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const error = await pending;
    expect(error).toBeInstanceOf(OcrUnavailableError);
  });

  it("süre dolduktan sonra gelen çalışan da kapatılır", async () => {
    seedLanguages();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const worker = fakeWorker();
    let resolveWorker: (value: unknown) => void = () => {};
    tesseract.createWorker.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveWorker = resolve;
        }),
    );

    const pending = extractFromImage(png(800, 600)).catch((err: unknown) => err);
    await vi.waitFor(() => expect(tesseract.createWorker).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(OCR_TIMEOUT_MS);
    expect(await pending).toBeInstanceOf(OcrUnavailableError);

    resolveWorker(worker);
    await vi.waitFor(() => expect(worker.terminate).toHaveBeenCalled());
    expect(worker.recognize).not.toHaveBeenCalled();
  });

  it("dil yükleme hatası bildirilirse beklemeden OcrUnavailableError döner", async () => {
    seedLanguages();
    tesseract.createWorker.mockImplementation((_langs: unknown, _oem: unknown, options: { errorHandler: (e: unknown) => void }) => {
      setImmediate(() => options.errorHandler("initialization failed"));
      return new Promise(() => {});
    });

    await expect(extractFromImage(png(800, 600))).rejects.toBeInstanceOf(OcrUnavailableError);
  });

  it("tanıma hatası OcrUnavailableError'a çevrilmez (dosya okunamadı sayılır)", async () => {
    seedLanguages();
    const worker = fakeWorker();
    tesseract.createWorker.mockImplementation(
      async (_langs: unknown, _oem: unknown, options: { errorHandler: (e: unknown) => void }) => {
        // tesseract.js tanıma hatasında hem errorHandler'ı çağırır hem de recognize sözünü reddeder.
        worker.recognize.mockImplementation(async () => {
          options.errorHandler("Error attempting to read image.");
          throw new Error("Error attempting to read image.");
        });
        return worker;
      },
    );

    const error = await extractFromImage(png(800, 600)).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(OcrUnavailableError);
    expect(worker.terminate).toHaveBeenCalledTimes(1);
  });

  it("dil verisi yoksa bir kez indirir, açarak yerine koyar ve geçici dosya bırakmaz", async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      const lang = url.includes("/tur/") ? "tur" : "eng";
      return new Response(new Uint8Array(gzipSync(Buffer.from(`${lang}-veri`))), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchSpy);
    tesseract.createWorker.mockResolvedValue(fakeWorker());

    await extractFromImage(png(800, 600));

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const urls = fetchSpy.mock.calls.map((call) => call[0]);
    expect(urls).toContain("https://cdn.jsdelivr.net/npm/@tesseract.js-data/tur/4.0.0_best_int/tur.traineddata.gz");
    expect(urls).toContain("https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz");
    expect(readFileSync(path.join(dir, "tur.traineddata"), "utf8")).toBe("tur-veri");
    expect(readFileSync(path.join(dir, "eng.traineddata"), "utf8")).toBe("eng-veri");
    expect(readdirSync(dir).sort()).toEqual(["eng.traineddata", "tur.traineddata"]);

    // İkinci çağrı yerel dosyayı kullanır.
    await extractFromImage(png(800, 600));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("dil verisi indirilemezse çalışan açmadan OcrUnavailableError fırlatır", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("yok", { status: 503 })),
    );

    await expect(extractFromImage(png(800, 600))).rejects.toBeInstanceOf(OcrUnavailableError);
    expect(tesseract.createWorker).not.toHaveBeenCalled();
    expect(existsSync(path.join(dir, "tur.traineddata"))).toBe(false);
    expect(readdirSync(dir)).toEqual([]);
  });

  it("indirme yanıt vermezse 15 sn sonra iptal edilir", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
          }),
      ),
    );

    const pending = extractFromImage(png(800, 600)).catch((err: unknown) => err);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(15_000);

    expect(await pending).toBeInstanceOf(OcrUnavailableError);
    expect(tesseract.createWorker).not.toHaveBeenCalled();
  });
});
