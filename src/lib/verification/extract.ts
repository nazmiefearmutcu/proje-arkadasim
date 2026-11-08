import { randomUUID } from "node:crypto";
import { access, mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { extractText, getDocumentProxy, getMeta } from "unpdf";
import { createWorker } from "tesseract.js";
import { readImageDimensions } from "./image-size";

/** Metin katmanı bu uzunluğun altındaysa PDF taranmış sayılır. */
export const MIN_PDF_TEXT_CHARS = 80;
/** OCR ortalama güveni (0–100) bu değerin altındaysa fotoğraf okunamamış sayılır. */
export const MIN_OCR_CONFIDENCE = 55;
/** e-Devlet belgeleri 1–2 sayfadır; daha uzun PDF'ler ayrıştırılmadan reddedilir. */
export const MAX_PDF_PAGES = 5;
/** OCR'a girecek görselin en uzun kenarı (piksel). */
export const MAX_IMAGE_SIDE_PX = 8000;
/** OCR'a girecek görselin en fazla piksel sayısı (40 MP). */
export const MAX_IMAGE_PIXELS = 40_000_000;
/** Çalışan oluşturma + tanıma için üst süre. Aşılırsa çalışan kapatılır. */
export const OCR_TIMEOUT_MS = 45_000;
/** Tesseract dil verisinin tek seferlik indirilmesi için üst süre. */
export const TESSDATA_DOWNLOAD_TIMEOUT_MS = 15_000;
export const OCR_LANGUAGES = ["tur", "eng"] as const;

const TESSDATA_MAX_BYTES = 64 * 1024 * 1024;
const OEM_LSTM_ONLY = 1;

/** Belge, ayrıştırma sınırlarını (sayfa sayısı ya da piksel boyutu) aşıyor. */
export class DocumentTooLargeError extends Error {
  readonly kind: "pdf-pages" | "image-pixels";

  constructor(kind: "pdf-pages" | "image-pixels") {
    super(kind === "pdf-pages" ? "PDF sayfa sınırını aşıyor." : "Görsel piksel sınırını aşıyor.");
    this.name = "DocumentTooLargeError";
    this.kind = kind;
  }
}

/** Yerel OCR çalıştırılamadı (dil verisi yok, indirilemedi, çalışan açılamadı ya da süre doldu). */
export class OcrUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OcrUnavailableError";
  }
}

export interface PdfSignals {
  producer: string | null;
  creator: string | null;
  createdAt: string | null;
  modifiedAt: string | null;
  incrementalUpdates: number;
  pageCount: number;
}

const EOF_MARKER = [0x25, 0x25, 0x45, 0x4f, 0x46]; // "%%EOF"

/** Ham baytlarda `%%EOF` kaç kez geçtiğini sayar. */
function countEofMarkers(buf: Uint8Array): number {
  let count = 0;
  for (let i = 0; i + EOF_MARKER.length <= buf.length; i++) {
    let matched = true;
    for (let j = 0; j < EOF_MARKER.length; j++) {
      if (buf[i + j] !== EOF_MARKER[j]) {
        matched = false;
        break;
      }
    }
    if (matched) count++;
  }
  return count;
}

function isoOrNull(value: Date | null | undefined): string | null {
  if (!(value instanceof Date)) return null;
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

function textOrNull(value: string | null | undefined): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

type PdfDocument = Awaited<ReturnType<typeof getDocumentProxy>>;

/**
 * PDF'in metin katmanını ve meta verisini yerel olarak çıkarır. pdf.js bayt dizisini
 * ayırabildiği için kopyasıyla çalışılır; asıl bayt dizisi çağırana aittir. Kopya ve pdf.js
 * belgesi her durumda (hata dahil) sıfırlanır ve kapatılır.
 */
export async function extractFromPdf(
  buf: Uint8Array,
): Promise<{ text: string; signals: PdfSignals }> {
  const incrementalUpdates = Math.max(0, countEofMarkers(buf) - 1);
  const copy = new Uint8Array(buf);
  let pdf: PdfDocument | null = null;
  try {
    pdf = await getDocumentProxy(copy);
    if (pdf.numPages > MAX_PDF_PAGES) throw new DocumentTooLargeError("pdf-pages");

    const { text } = await extractText(pdf, { mergePages: true });
    const { info } = await getMeta(pdf, { parseDates: true });

    return {
      text,
      signals: {
        producer: textOrNull(info.Producer),
        creator: textOrNull(info.Creator),
        createdAt: isoOrNull(info.CreationDate),
        modifiedAt: isoOrNull(info.ModDate),
        incrementalUpdates,
        pageCount: pdf.numPages,
      },
    };
  } finally {
    // pdf.js 5'te PDFDocumentProxy.destroy yok; belge, yükleme görevi üzerinden kapatılır.
    if (pdf) await pdf.loadingTask.destroy().catch(() => {});
    // pdf.js tamponu ayırmış (detached) olabilir; o durumda byteLength 0'dır ve fill hata verir.
    if (copy.byteLength > 0) copy.fill(0);
  }
}

/**
 * Tesseract dil verisinin klasörü. Üretimde dışarıya çıkış kısıtlıysa dosyalar önceden buraya
 * konur (`tur.traineddata`, `eng.traineddata`).
 */
export function tessdataDir(): string {
  return process.env.TESSDATA_LANG_PATH || path.join(process.cwd(), "storage", "tessdata");
}

/** tesseract.js'in LSTM (OEM 1) için kendi kullandığı adres; yalnız dosya yoksa bir kez indirilir. */
function tessdataUrl(lang: string): string {
  return `https://cdn.jsdelivr.net/npm/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`;
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

const pendingDownloads = new Map<string, Promise<void>>();

async function downloadLanguageFile(dir: string, lang: string, target: string): Promise<void> {
  const temp = `${target}.${process.pid}.${randomUUID()}.tmp`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TESSDATA_DOWNLOAD_TIMEOUT_MS);
  try {
    await mkdir(dir, { recursive: true });
    const response = await fetch(tessdataUrl(lang), { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength === 0 || body.byteLength > TESSDATA_MAX_BYTES) throw new Error("Beklenmeyen boyut.");
    // Dosya gzip'li gelir; tesseract önbelleği gibi açılmış halde saklanır.
    const isGzip = body[0] === 0x1f && body[1] === 0x8b;
    const data = isGzip ? gunzipSync(body, { maxOutputLength: TESSDATA_MAX_BYTES }) : body;
    await writeFile(temp, data);
    try {
      await rename(temp, target);
    } catch (error) {
      // Eşzamanlı başka bir indirme dosyayı yerine koymuş olabilir.
      if (!(await fileExists(target))) throw error;
    }
  } catch {
    throw new OcrUnavailableError(`OCR dil verisi (${lang}) indirilemedi.`);
  } finally {
    clearTimeout(timer);
    await rm(temp, { force: true }).catch(() => {});
  }
}

/** `<dir>/<lang>.traineddata` yoksa bir kez indirir; aynı anda gelen istekler tek indirmeyi bekler. */
async function ensureLanguageFile(dir: string, lang: string): Promise<void> {
  const target = path.join(dir, `${lang}.traineddata`);
  if (await fileExists(target)) return;
  let pending = pendingDownloads.get(target);
  if (!pending) {
    pending = downloadLanguageFile(dir, lang, target).finally(() => pendingDownloads.delete(target));
    pendingDownloads.set(target, pending);
  }
  await pending;
}

type TesseractWorker = Awaited<ReturnType<typeof createWorker>>;

/**
 * Çalışanı yerel dil verisiyle açar ve görseli tanır. tesseract.js dil yükleme hatasında
 * createWorker sözünü hiç sonuçlandırmaz; bu yüzden hata bildirimi (errorHandler) ve üst süre
 * ile yarıştırılır. Süre dolduktan sonra gelen çalışan da kapatılır.
 */
async function recognizeLocally(dir: string, image: Buffer): Promise<{ text: string; confidence: number }> {
  const state: { worker: TesseractWorker | null; settled: boolean } = { worker: null, settled: false };
  let timer: ReturnType<typeof setTimeout> | undefined;
  let failLoad: (error: Error) => void = () => {};

  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new OcrUnavailableError("OCR zaman aşımına uğradı.")), OCR_TIMEOUT_MS);
  });
  const loadFailed = new Promise<never>((_, reject) => {
    failLoad = reject;
  });

  const work = (async () => {
    const created = createWorker([...OCR_LANGUAGES], OEM_LSTM_ONLY, {
      langPath: dir,
      cachePath: dir,
      // Dil dosyalarını uygulama kendisi yazar; tesseract önbelleğe yazmasın ve açılış hatasında
      // operatörün TESSDATA_LANG_PATH klasöründeki dosyaları silmesin.
      cacheMethod: "readOnly",
      gzip: false,
      // Tanıma hatası kendi sözüyle döner; burada yalnız çalışan açılırken gelen hatalar yakalanır.
      // errorHandler verilmezse tesseract.js hatayı olay dinleyicisinde fırlatır ve süreci düşürür.
      errorHandler: () => {
        if (!state.worker) failLoad(new OcrUnavailableError("OCR dil verisi yüklenemedi."));
      },
    });
    created.then(
      (worker) => {
        if (state.settled) void worker.terminate();
      },
      () => {},
    );
    const worker = await created;
    if (state.settled) throw new OcrUnavailableError("OCR iptal edildi.");
    state.worker = worker;
    const { data } = await worker.recognize(image);
    return { text: data.text, confidence: data.confidence };
  })();

  try {
    return await Promise.race([work, timeout, loadFailed]);
  } finally {
    state.settled = true;
    clearTimeout(timer);
    if (state.worker) await state.worker.terminate().catch(() => {});
  }
}

/**
 * Fotoğraftaki metni yerel OCR (tesseract.js, Türkçe + İngilizce) ile okur. Piksel boyutu başlıktan
 * okunur ve sınır aşılırsa OCR hiç başlamaz. Dil verisi yalnız yerel klasörden okunur.
 */
export async function extractFromImage(
  buf: Uint8Array,
): Promise<{ text: string; confidence: number }> {
  const size = readImageDimensions(buf);
  if (!size || size.width === 0 || size.height === 0) throw new Error("Görsel başlığı okunamadı.");
  if (
    size.width > MAX_IMAGE_SIDE_PX ||
    size.height > MAX_IMAGE_SIDE_PX ||
    size.width * size.height > MAX_IMAGE_PIXELS
  ) {
    throw new DocumentTooLargeError("image-pixels");
  }

  const dir = tessdataDir();
  // allSettled: istek bittiğinde arkada süren bir indirme kalmaz.
  const ready = await Promise.allSettled(OCR_LANGUAGES.map((lang) => ensureLanguageFile(dir, lang)));
  const failed = ready.find((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failed) throw failed.reason;

  const image = Buffer.from(buf);
  try {
    return await recognizeLocally(dir, image);
  } finally {
    image.fill(0);
  }
}
