// Dosya türünü yalnızca sihirli baytlardan belirler (spec §5.1 adım 1). Uzantı ve MIME'a güvenilmez.

export type DocumentFileType = "pdf" | "jpeg" | "png" | "webp";

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF_MAGIC = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_MAGIC = [0x57, 0x45, 0x42, 0x50]; // "WEBP" (ofset 8)

function matchesAt(buf: Uint8Array, offset: number, magic: readonly number[]): boolean {
  if (buf.length < offset + magic.length) return false;
  return magic.every((byte, index) => buf[offset + index] === byte);
}

/** Bayt dizisinin başındaki sihirli değerlere bakarak türünü döndürür; tanınmazsa null. */
export function sniffFileType(buf: Uint8Array): DocumentFileType | null {
  if (matchesAt(buf, 0, PDF_MAGIC)) return "pdf";
  if (matchesAt(buf, 0, JPEG_MAGIC)) return "jpeg";
  if (matchesAt(buf, 0, PNG_MAGIC)) return "png";
  if (matchesAt(buf, 0, RIFF_MAGIC) && matchesAt(buf, 8, WEBP_MAGIC)) return "webp";
  return null;
}
