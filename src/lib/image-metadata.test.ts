import { crc32 } from "node:zlib";
import { describe, expect, it } from "vitest";
import { sniffFileType } from "@/lib/verification/sniff";
import { stripImageMetadata } from "./image-metadata";

// Testler gerçek resim dosyası kullanmaz: biçimlerin kap yapısı (JPEG bölümleri, PNG parçaları,
// RIFF parçaları) burada elle kurulur. Görüntü verisi yerine sabit baytlar durur.

const SECRET = "GPS-41.0082N-28.9784E-iPhone-SECRET";
const enc = (text: string) => new TextEncoder().encode(text);
const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString("latin1");

function concat(...parts: Array<Uint8Array | number[]>): Uint8Array {
  return Uint8Array.from(parts.flatMap((part) => [...part]));
}

/** IFD0'da Orientation ve (gizli değer taşıyan) bir ASCII alanı olan küçük TIFF. */
function tiffWithOrientation(orientation: number | null, littleEndian = true): Uint8Array {
  const secret = enc(`${SECRET}\0`);
  const u16 = (v: number) => (littleEndian ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  const u32 = (v: number) =>
    littleEndian
      ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24]
      : [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
  const entries: number[][] = [];
  const count = orientation === null ? 1 : 2;
  const dataOffset = 8 + 2 + count * 12 + 4;
  // 0x0110 Model (ASCII), değeri IFD'nin arkasında.
  entries.push([...u16(0x0110), ...u16(2), ...u32(secret.length), ...u32(dataOffset)]);
  if (orientation !== null) entries.push([...u16(0x0112), ...u16(3), ...u32(1), ...u16(orientation), 0, 0]);
  return concat(
    littleEndian ? [0x49, 0x49] : [0x4d, 0x4d],
    u16(42),
    u32(8),
    u16(count),
    ...entries,
    u32(0),
    secret,
  );
}

function jpegSegment(marker: number, payload: Uint8Array | number[]): Uint8Array {
  const length = payload.length + 2;
  return concat([0xff, marker, length >> 8, length & 0xff], payload);
}

// Entropi kodlu veri: FF00 doldurması ve RST işareti içerir, ayrıştırıcı bunları işaret sanmamalı.
const SCAN_DATA = [0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd0, 0x78, 0x9a];
const JFIF = jpegSegment(0xe0, concat(enc("JFIF\0"), [1, 1, 0, 0, 1, 0, 1, 0, 0]));
const ICC = jpegSegment(0xe2, concat(enc("ICC_PROFILE\0"), [1, 1], enc("icc-profile-bytes")));
const ADOBE = jpegSegment(0xee, concat(enc("Adobe"), [0, 100, 0, 0, 0, 0, 1]));
const DQT = jpegSegment(0xdb, [0x00, ...new Array<number>(64).fill(1)]);
const SOF0 = jpegSegment(0xc0, [8, 0, 16, 0, 16, 1, 1, 0x11, 0]);
const SOS = concat(jpegSegment(0xda, [1, 1, 0, 0, 63, 0]), SCAN_DATA);

function jpegWithMetadata(orientation: number | null): Uint8Array {
  return concat(
    [0xff, 0xd8],
    JFIF,
    jpegSegment(0xe1, concat(enc("Exif\0\0"), tiffWithOrientation(orientation))),
    jpegSegment(0xe1, enc(`http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>${SECRET}</x:xmpmeta>`)),
    jpegSegment(0xe2, concat(enc("MPF\0"), enc(SECRET))),
    jpegSegment(0xed, enc(`Photoshop 3.0\0${SECRET}`)),
    jpegSegment(0xfe, enc(`yorum ${SECRET}`)),
    ICC,
    ADOBE,
    DQT,
    SOF0,
    SOS,
    [0xff, 0xd9],
    enc(`TRAILER ${SECRET}`),
  );
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = enc(type);
  const length = [data.length >>> 24, (data.length >> 16) & 0xff, (data.length >> 8) & 0xff, data.length & 0xff];
  const crc = crc32(concat(typeBytes, data));
  return concat(length, typeBytes, data, [crc >>> 24, (crc >> 16) & 0xff, (crc >> 8) & 0xff, crc & 0xff]);
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const IHDR = pngChunk("IHDR", Uint8Array.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]));
const ICCP = pngChunk("iCCP", concat(enc("icc\0"), [0], enc("compressed-profile")));
const IDAT = pngChunk("IDAT", Uint8Array.from([0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01]));
const IEND = pngChunk("IEND", new Uint8Array(0));

function pngWithMetadata(orientation: number | null): Uint8Array {
  return concat(
    PNG_SIGNATURE,
    IHDR,
    ICCP,
    pngChunk("eXIf", tiffWithOrientation(orientation, false)),
    pngChunk("tEXt", enc(`Author\0${SECRET}`)),
    pngChunk("iTXt", enc(`XML:com.adobe.xmp\0\0\0\0\0${SECRET}`)),
    pngChunk("zTXt", concat(enc("Comment\0"), [0], enc(SECRET))),
    pngChunk("tIME", Uint8Array.from([0x07, 0xea, 11, 8, 12, 0, 0])),
    IDAT,
    IEND,
    enc(`TRAILER ${SECRET}`),
  );
}

function riffChunk(fourcc: string, data: Uint8Array | number[]): Uint8Array {
  const size = data.length;
  const pad = size & 1 ? [0] : [];
  return concat(enc(fourcc), [size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, size >>> 24], data, pad);
}

function riff(chunks: Uint8Array[]): Uint8Array {
  const body = concat(enc("WEBP"), ...chunks);
  const size = body.length;
  return concat(enc("RIFF"), [size & 0xff, (size >> 8) & 0xff, (size >> 16) & 0xff, size >>> 24], body);
}

const VP8X_ALL_FLAGS = 0x20 | 0x08 | 0x04; // ICC + EXIF + XMP
const VP8X = riffChunk("VP8X", [VP8X_ALL_FLAGS, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const WEBP_ICCP = riffChunk("ICCP", enc("icc-profile-bytes"));
const VP8 = riffChunk("VP8 ", [0x10, 0x02, 0x00, 0x9d, 0x01, 0x2a, 0x01, 0x00, 0x01]); // tek boyut: dolgu baytı

function webpWithMetadata(orientation: number | null): Uint8Array {
  return riff([
    VP8X,
    WEBP_ICCP,
    VP8,
    riffChunk("EXIF", tiffWithOrientation(orientation)),
    riffChunk("XMP ", enc(`<x:xmpmeta>${SECRET}</x:xmpmeta>`)),
  ]);
}

function riffSize(bytes: Uint8Array): number {
  return bytes[4] | (bytes[5] << 8) | (bytes[6] << 16) | (bytes[7] << 24);
}

describe("stripImageMetadata — JPEG", () => {
  it("EXIF/XMP/IPTC/COM/MPF bölümlerini ve EOI sonrası eki atar; JFIF, ICC, Adobe ve görüntüyü korur", () => {
    const out = stripImageMetadata(jpegWithMetadata(null), "jpeg");
    const text = latin1(out);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("Exif");
    expect(text).not.toContain("http://ns.adobe.com/xap");
    expect(text).not.toContain("Photoshop");
    expect(sniffFileType(out)).toBe("jpeg");
    expect(out).toEqual(concat([0xff, 0xd8], JFIF, ICC, ADOBE, DQT, SOF0, SOS, [0xff, 0xd9]));
  });

  it("yön bilgisini (Orientation 6) yalnız o alanı içeren küçük bir EXIF ile korur", () => {
    const out = stripImageMetadata(jpegWithMetadata(6), "jpeg");
    expect(latin1(out)).not.toContain(SECRET);
    const app1 = latin1(out).indexOf("Exif\0\0");
    expect(app1).toBeGreaterThan(0);
    // FF E1 00 22 "Exif\0\0" + 26 baytlık TIFF; değer ofseti 8+2+8 = 18.
    expect([...out.subarray(app1 - 4, app1)]).toEqual([0xff, 0xe1, 0x00, 0x22]);
    const tiff = out.subarray(app1 + 6, app1 + 6 + 26);
    expect([...tiff.subarray(0, 4)]).toEqual([0x49, 0x49, 0x2a, 0x00]);
    expect(tiff[18]).toBe(6);
    expect(sniffFileType(out)).toBe("jpeg");
  });

  it("ayrıştırılamayan baytları değiştirmeden döner", () => {
    const fake = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
    expect(stripImageMetadata(fake, "jpeg")).toBe(fake);
    const truncated = jpegWithMetadata(null).subarray(0, 30);
    expect(stripImageMetadata(truncated, "jpeg")).toBe(truncated);
  });
});

describe("stripImageMetadata — PNG", () => {
  it("eXIf, tEXt, iTXt, zTXt, tIME parçalarını ve IEND sonrası eki atar; iCCP'yi korur", () => {
    const out = stripImageMetadata(pngWithMetadata(null), "png");
    const text = latin1(out);
    expect(text).not.toContain(SECRET);
    for (const type of ["eXIf", "tEXt", "iTXt", "zTXt", "tIME"]) expect(text).not.toContain(type);
    expect(sniffFileType(out)).toBe("png");
    expect(out).toEqual(concat(PNG_SIGNATURE, IHDR, ICCP, IDAT, IEND));
  });

  it("yönü geçerli CRC'li küçük bir eXIf parçasıyla korur", () => {
    const out = stripImageMetadata(pngWithMetadata(3), "png");
    expect(latin1(out)).not.toContain(SECRET);
    const expectedTiff = Uint8Array.from([
      0x49, 0x49, 0x2a, 0, 8, 0, 0, 0, 1, 0, 0x12, 0x01, 3, 0, 1, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect(out).toEqual(concat(PNG_SIGNATURE, IHDR, ICCP, pngChunk("eXIf", expectedTiff), IDAT, IEND));
  });

  it("bozuk parça uzunluğunda baytları değiştirmeden döner", () => {
    const broken = concat(PNG_SIGNATURE, [0x7f, 0, 0, 0], enc("IHDR"), [1, 2, 3]);
    expect(stripImageMetadata(broken, "png")).toBe(broken);
  });
});

describe("stripImageMetadata — WebP", () => {
  it("EXIF ve XMP parçalarını atar, VP8X bayraklarını ve RIFF boyutunu düzeltir", () => {
    const out = stripImageMetadata(webpWithMetadata(null), "webp");
    const text = latin1(out);
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain("EXIF");
    expect(text).not.toContain("XMP ");
    expect(text).toContain("ICCP");
    expect(sniffFileType(out)).toBe("webp");
    expect(riffSize(out)).toBe(out.length - 8);
    const expectedVp8x = riffChunk("VP8X", [0x20, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(out).toEqual(riff([expectedVp8x, WEBP_ICCP, VP8]));
  });

  it("yönü küçük bir EXIF parçasıyla korur ve EXIF bayrağını açık bırakır", () => {
    const out = stripImageMetadata(webpWithMetadata(8), "webp");
    expect(latin1(out)).not.toContain(SECRET);
    expect(riffSize(out)).toBe(out.length - 8);
    const vp8xFlags = out[12 + 8];
    expect(vp8xFlags & 0x08).toBe(0x08);
    expect(vp8xFlags & 0x04).toBe(0);
    const exifAt = latin1(out).indexOf("EXIF");
    expect(out[exifAt + 4]).toBe(26);
    expect(out[exifAt + 8 + 18]).toBe(8);
  });

  it("RIFF boyutu dosyadan büyükse baytları değiştirmeden döner", () => {
    const whole = webpWithMetadata(null);
    const truncated = whole.subarray(0, whole.length - 10);
    expect(stripImageMetadata(truncated, "webp")).toBe(truncated);
  });
});
