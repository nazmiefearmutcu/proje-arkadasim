import { mkdir } from "node:fs/promises";
import path from "node:path";
import { extractText, getDocumentProxy, getMeta } from "unpdf";
import { createWorker } from "tesseract.js";

/** Metin katmanı bu uzunluğun altındaysa PDF taranmış sayılır. */
export const MIN_PDF_TEXT_CHARS = 80;
/** OCR ortalama güveni (0–100) bu değerin altındaysa fotoğraf okunamamış sayılır. */
export const MIN_OCR_CONFIDENCE = 55;

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

/**
 * PDF'in metin katmanını ve meta verisini yerel olarak çıkarır. pdf.js bayt dizisini
 * ayırabildiği için kopyasıyla çalışılır; asıl bayt dizisi çağırana aittir.
 */
export async function extractFromPdf(
  buf: Uint8Array,
): Promise<{ text: string; signals: PdfSignals }> {
  const copy = new Uint8Array(buf);
  const pdf = await getDocumentProxy(copy);
  const { text } = await extractText(pdf, { mergePages: true });
  const { info } = await getMeta(pdf, { parseDates: true });
  const incrementalUpdates = Math.max(0, countEofMarkers(buf) - 1);

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
}

/** Fotoğraftaki metni yerel OCR (tesseract.js, Türkçe + İngilizce) ile okur. */
export async function extractFromImage(
  buf: Uint8Array,
): Promise<{ text: string; confidence: number }> {
  const cachePath = path.join(process.cwd(), "storage", "tessdata");
  await mkdir(cachePath, { recursive: true });

  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  try {
    worker = await createWorker(["tur", "eng"], 1, { cachePath });
    const { data } = await worker.recognize(Buffer.from(buf));
    return { text: data.text, confidence: data.confidence };
  } finally {
    if (worker) await worker.terminate();
  }
}
