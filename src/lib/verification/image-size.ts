// Görselin piksel boyutunu dosya başlığından okur (PNG IHDR, JPEG SOFn, WebP VP8/VP8L/VP8X).
// Saf fonksiyon: görseli çözmez, yalnız birkaç bayta bakar. OCR başlamadan önce çok büyük
// görselleri durdurmak için kullanılır. Okunamayan başlıkta null döner.

export interface ImageDimensions {
  width: number;
  height: number;
}

function ascii(buf: Uint8Array, offset: number, text: string): boolean {
  if (offset + text.length > buf.length) return false;
  for (let i = 0; i < text.length; i++) {
    if (buf[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

function u16be(buf: Uint8Array, offset: number): number {
  return (buf[offset] << 8) | buf[offset + 1];
}

function u16le(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8);
}

function u24le(buf: Uint8Array, offset: number): number {
  return buf[offset] | (buf[offset + 1] << 8) | (buf[offset + 2] << 16);
}

function u32be(buf: Uint8Array, offset: number): number {
  return ((buf[offset] << 24) >>> 0) + ((buf[offset + 1] << 16) | (buf[offset + 2] << 8) | buf[offset + 3]);
}

function pngDimensions(buf: Uint8Array): ImageDimensions | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (buf.length < 24 || signature.some((byte, i) => buf[i] !== byte)) return null;
  if (!ascii(buf, 12, "IHDR")) return null;
  return { width: u32be(buf, 16), height: u32be(buf, 20) };
}

// Boyut taşıyan SOF işaretleri: C0–CF, DHT (C4), JPG (C8) ve DAC (CC) hariç.
function isStartOfFrame(marker: number): boolean {
  return marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
}

function jpegDimensions(buf: Uint8Array): ImageDimensions | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset < buf.length) {
    if (buf[offset] !== 0xff) return null;
    // Dolgu baytları (art arda 0xFF) atlanır.
    while (offset < buf.length && buf[offset] === 0xff) offset++;
    if (offset >= buf.length) return null;
    const marker = buf[offset];
    offset++;
    // Uzunluk alanı olmayan işaretler: TEM, RSTn, SOI.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    // Görüntü verisi ya da dosya sonu boyuttan önce geldiyse başlık geçersizdir.
    if (marker === 0xd9 || marker === 0xda) return null;
    if (offset + 2 > buf.length) return null;
    const length = u16be(buf, offset);
    if (length < 2) return null;
    if (isStartOfFrame(marker)) {
      if (offset + 7 > buf.length) return null;
      return { height: u16be(buf, offset + 3), width: u16be(buf, offset + 5) };
    }
    offset += length;
  }
  return null;
}

function webpDimensions(buf: Uint8Array): ImageDimensions | null {
  if (!ascii(buf, 0, "RIFF") || !ascii(buf, 8, "WEBP")) return null;
  if (ascii(buf, 12, "VP8X")) {
    if (buf.length < 30) return null;
    return { width: u24le(buf, 24) + 1, height: u24le(buf, 27) + 1 };
  }
  if (ascii(buf, 12, "VP8L")) {
    if (buf.length < 25 || buf[20] !== 0x2f) return null;
    const bits = (buf[21] | (buf[22] << 8) | (buf[23] << 16) | (buf[24] << 24)) >>> 0;
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (ascii(buf, 12, "VP8 ")) {
    if (buf.length < 30) return null;
    if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
    return { width: u16le(buf, 26) & 0x3fff, height: u16le(buf, 28) & 0x3fff };
  }
  return null;
}

/** PNG, JPEG veya WebP başlığından genişlik ve yüksekliği okur; okunamazsa null. */
export function readImageDimensions(buf: Uint8Array): ImageDimensions | null {
  return pngDimensions(buf) ?? jpegDimensions(buf) ?? webpDimensions(buf);
}
