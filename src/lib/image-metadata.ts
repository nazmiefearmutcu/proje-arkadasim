// Profil resimlerinden gömülü meta veriyi (EXIF konum/cihaz bilgisi, XMP, IPTC, yorumlar) temizler.
// Profil resimleri misafirlere de sunulduğu için bir telefonun yazdığı GPS koordinatları
// ifşa edilmemelidir (KVKK veri minimizasyonu). Saf modüldür: girdiyi değiştirmez, dışarıya erişmez.
//
// Kurallar:
// - JPEG: APP1 (EXIF/XMP), APP13 (IPTC), COM ve diğer APPn bölümleri atılır. APP0 (JFIF),
//   APP2 ICC profili ve APP14 (Adobe renk) korunur. EOI'den sonraki ekler (MPF ikincil
//   resimleri, üretici ekleri) atılır.
// - PNG: eXIf, tEXt, iTXt, zTXt ve tIME parçaları atılır; iCCP ve görüntü parçaları korunur.
// - WebP: EXIF ve XMP parçaları atılır, VP8X bayrakları ve RIFF boyutu düzeltilir.
// - Yön (EXIF Orientation 2..8) varsa yalnız o alanı içeren küçük bir EXIF yazılır; aksi halde
//   telefonla dik çekilen fotoğraf tarayıcıda yan dönerdi. Başka hiçbir EXIF alanı taşınmaz.
// Ayrıştırma başarısız olursa (bozuk ya da beklenmedik yapı) baytlar değiştirilmeden döner.

export type StrippableImageType = "jpeg" | "png" | "webp";

const EXIF_HEADER = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00]; // "Exif\0\0"
const ICC_HEADER = "ICC_PROFILE\0";
const ADOBE_HEADER = "Adobe";
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_DROPPED_CHUNKS = new Set(["eXIf", "tEXt", "iTXt", "zTXt", "tIME"]);
const ORIENTATION_TAG = 0x0112;
const VP8X_XMP_FLAG = 0x04;
const VP8X_EXIF_FLAG = 0x08;

/** Meta veriyi temizlenmiş yeni bir bayt dizisi döner; ayrıştırılamazsa girdinin kendisini döner. */
export function stripImageMetadata(bytes: Uint8Array, type: StrippableImageType): Uint8Array {
  try {
    const stripped =
      type === "jpeg" ? stripJpeg(bytes) : type === "png" ? stripPng(bytes) : stripWebp(bytes);
    return stripped ?? bytes;
  } catch {
    return bytes;
  }
}

// ---------------------------------------------------------------------------------------------
// Ortak yardımcılar

function startsWith(bytes: Uint8Array, offset: number, prefix: readonly number[] | string): boolean {
  const values = typeof prefix === "string" ? [...prefix].map((ch) => ch.charCodeAt(0)) : prefix;
  if (bytes.length < offset + values.length) return false;
  return values.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function readU16(bytes: Uint8Array, offset: number, littleEndian: boolean): number {
  return littleEndian
    ? bytes[offset] | (bytes[offset + 1] << 8)
    : (bytes[offset] << 8) | bytes[offset + 1];
}

function readU32(bytes: Uint8Array, offset: number, littleEndian: boolean): number {
  const value = littleEndian
    ? bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)
    : (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
  return value >>> 0;
}

function writeU32(target: Uint8Array, offset: number, value: number, littleEndian: boolean): void {
  const bytes = [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
  target.set(littleEndian ? bytes.reverse() : bytes, offset);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** TIFF yapısındaki (EXIF gövdesi) IFD0 Orientation değeri; yoksa ya da geçersizse null. */
function readOrientation(tiff: Uint8Array): number | null {
  if (tiff.length < 8) return null;
  const order = ascii(tiff, 0, 2);
  if (order !== "II" && order !== "MM") return null;
  const le = order === "II";
  if (readU16(tiff, 2, le) !== 42) return null;
  const ifd = readU32(tiff, 4, le);
  if (ifd + 2 > tiff.length) return null;
  const count = readU16(tiff, ifd, le);
  for (let index = 0; index < count; index++) {
    const entry = ifd + 2 + index * 12;
    if (entry + 12 > tiff.length) return null;
    if (readU16(tiff, entry, le) !== ORIENTATION_TAG) continue;
    // SHORT (3), tek değer; değer alanının ilk iki baytında durur.
    if (readU16(tiff, entry + 2, le) !== 3 || readU32(tiff, entry + 4, le) !== 1) return null;
    const value = readU16(tiff, entry + 8, le);
    return value >= 1 && value <= 8 ? value : null;
  }
  return null;
}

/** Yalnız Orientation alanını içeren 26 baytlık küçük TIFF (EXIF gövdesi). */
function minimalOrientationTiff(orientation: number): Uint8Array {
  return Uint8Array.of(
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, // "II", 42, IFD0 ofseti 8
    0x01, 0x00, // 1 alan
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation, 0x00, 0x00, 0x00, // 0x0112 SHORT x1
    0x00, 0x00, 0x00, 0x00, // sonraki IFD yok
  );
}

/** Korunacak yön bilgisi (2..8) varsa küçük TIFF; normal yön (1) ya da yoksa null. */
function orientationOnlyTiff(tiff: Uint8Array): Uint8Array | null {
  const orientation = readOrientation(tiff);
  return orientation !== null && orientation > 1 ? minimalOrientationTiff(orientation) : null;
}

// ---------------------------------------------------------------------------------------------
// JPEG

function isStandaloneJpegMarker(marker: number): boolean {
  return marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
}

function stripJpeg(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const parts: Uint8Array[] = [bytes.subarray(0, 2)];
  let offset = 2;
  let sawScan = false;
  let wroteOrientation = false;

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    let markerAt = offset + 1;
    while (markerAt < bytes.length && bytes[markerAt] === 0xff) markerAt++; // dolgu baytları
    if (markerAt >= bytes.length) return null;
    const marker = bytes[markerAt];

    if (marker === 0xd9) {
      // EOI: görüntü biter; sonrasındaki ekler (MPF ikincil resimleri, üretici verisi) atılır.
      parts.push(Uint8Array.of(0xff, 0xd9));
      return sawScan ? concat(parts) : null;
    }
    if (isStandaloneJpegMarker(marker)) {
      parts.push(Uint8Array.of(0xff, marker));
      offset = markerAt + 1;
      continue;
    }
    if (markerAt + 2 >= bytes.length) return null;
    const length = (bytes[markerAt + 1] << 8) | bytes[markerAt + 2];
    if (length < 2) return null;
    const end = markerAt + 1 + length;
    if (end > bytes.length) return null;
    const payloadStart = markerAt + 3;
    const segment = Uint8Array.of(0xff, marker);

    if (marker === 0xda) {
      // SOS: başlıktan sonra entropi kodlu veri gelir; FF00 ve RSTn dışındaki ilk işarete kadar sürer.
      sawScan = true;
      let scan = end;
      while (scan < bytes.length) {
        if (bytes[scan] !== 0xff) {
          scan++;
          continue;
        }
        const next = bytes[scan + 1];
        if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) scan += 2;
        else if (next === 0xff) scan += 1;
        else break;
      }
      parts.push(segment, bytes.subarray(markerAt + 1, Math.min(scan, bytes.length)));
      if (scan >= bytes.length) return concat(parts); // EOI'siz (kesik) dosya: görüntü verisi korunur
      offset = scan;
      continue;
    }

    const isApp = marker >= 0xe0 && marker <= 0xef;
    if (isApp || marker === 0xfe) {
      const keep =
        marker === 0xe0 ||
        (marker === 0xe2 && startsWith(bytes, payloadStart, ICC_HEADER)) ||
        (marker === 0xee && startsWith(bytes, payloadStart, ADOBE_HEADER));
      if (keep) {
        parts.push(segment, bytes.subarray(markerAt + 1, end));
      } else if (marker === 0xe1 && !wroteOrientation && startsWith(bytes, payloadStart, EXIF_HEADER)) {
        const tiff = orientationOnlyTiff(bytes.subarray(payloadStart + EXIF_HEADER.length, end));
        if (tiff) {
          const segmentLength = 2 + EXIF_HEADER.length + tiff.length;
          parts.push(
            Uint8Array.of(0xff, 0xe1, segmentLength >> 8, segmentLength & 0xff, ...EXIF_HEADER),
            tiff,
          );
          wroteOrientation = true;
        }
      }
      offset = end;
      continue;
    }

    parts.push(segment, bytes.subarray(markerAt + 1, end));
    offset = end;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// PNG

let crcTable: Uint32Array | null = null;

function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  writeU32(chunk, 0, data.length, false);
  chunk.set([...type].map((ch) => ch.charCodeAt(0)), 4);
  chunk.set(data, 8);
  writeU32(chunk, 8 + data.length, crc32(chunk.subarray(4, 8 + data.length)), false);
  return chunk;
}

function stripPng(bytes: Uint8Array): Uint8Array | null {
  if (!startsWith(bytes, 0, PNG_SIGNATURE)) return null;
  const parts: Uint8Array[] = [bytes.subarray(0, 8)];
  let offset = 8;

  while (offset + 12 <= bytes.length) {
    const length = readU32(bytes, offset, false);
    const type = ascii(bytes, offset + 4, 4);
    if (!/^[A-Za-z]{4}$/.test(type)) return null;
    const end = offset + 12 + length;
    if (length > 0x7fffffff || end > bytes.length) return null;

    if (type === "eXIf") {
      const tiff = orientationOnlyTiff(bytes.subarray(offset + 8, offset + 8 + length));
      if (tiff) parts.push(pngChunk("eXIf", tiff));
    } else if (!PNG_DROPPED_CHUNKS.has(type)) {
      parts.push(bytes.subarray(offset, end));
    }
    offset = end;
    // IEND'den sonraki ekler atılır.
    if (type === "IEND") return concat(parts);
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// WebP

function riffChunk(fourcc: string, data: Uint8Array): Uint8Array {
  const padded = data.length + (data.length & 1);
  const chunk = new Uint8Array(8 + padded);
  chunk.set([...fourcc].map((ch) => ch.charCodeAt(0)), 0);
  writeU32(chunk, 4, data.length, true);
  chunk.set(data, 8);
  return chunk;
}

function stripWebp(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 12 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return null;
  const riffEnd = 8 + readU32(bytes, 4, true);
  if (riffEnd > bytes.length || riffEnd < 12) return null;

  const parts: Uint8Array[] = [];
  let vp8x: Uint8Array | null = null;
  let keptExif = false;
  let offset = 12;

  while (offset < riffEnd) {
    if (offset + 8 > riffEnd) return null;
    const fourcc = ascii(bytes, offset, 4);
    const size = readU32(bytes, offset + 4, true);
    const dataEnd = offset + 8 + size;
    if (dataEnd > riffEnd) return null;
    // Tek boyutlu parçalardan sonra bir dolgu baytı gelir (dosya sonunda eksik olabilir).
    const end = Math.min(dataEnd + (size & 1), riffEnd);
    const data = bytes.subarray(offset + 8, dataEnd);

    if (fourcc === "EXIF") {
      // Bazı yazıcılar gövdenin başına "Exif\0\0" koyar.
      const tiffBody = startsWith(data, 0, EXIF_HEADER) ? data.subarray(EXIF_HEADER.length) : data;
      const tiff = keptExif ? null : orientationOnlyTiff(tiffBody);
      if (tiff) {
        parts.push(riffChunk("EXIF", tiff));
        keptExif = true;
      }
    } else if (fourcc === "XMP ") {
      // atılır
    } else if (fourcc === "VP8X") {
      if (size < 10) return null;
      vp8x = bytes.slice(offset, end);
      parts.push(vp8x);
    } else {
      parts.push(bytes.subarray(offset, end));
    }
    offset = end;
  }

  if (vp8x) {
    // VP8X bayrak baytı (parça başlığından sonraki ilk bayt): XMP her zaman, EXIF yön yoksa kapanır.
    vp8x[8] &= ~(VP8X_XMP_FLAG | VP8X_EXIF_FLAG);
    if (keptExif) vp8x[8] |= VP8X_EXIF_FLAG;
  }
  const header = new Uint8Array(12);
  header.set(bytes.subarray(0, 12));
  const body = concat(parts);
  writeU32(header, 4, 4 + body.length, true);
  return concat([header, body]);
}
