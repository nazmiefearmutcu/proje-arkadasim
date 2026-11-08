import { describe, expect, it } from "vitest";
import { readImageDimensions } from "./image-size";

function png(width: number, height: number): Uint8Array {
  const buf = new Uint8Array(33);
  buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  buf.set([0x00, 0x00, 0x00, 0x0d], 8);
  buf.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
  const view = new DataView(buf.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return buf;
}

function jpeg(width: number, height: number, sofMarker = 0xc0): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // APP0
    0xff, 0xdb, 0x00, 0x04, 0x00, 0x00, // DQT (kısaltılmış)
    0xff, 0xc4, 0x00, 0x04, 0x00, 0x00, // DHT: boyut taşımaz
    0xff, sofMarker, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03,
    0x01, 0x22, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xda, 0x00, 0x02, // SOS
  ]);
}

function riff(chunk: string, payload: number[]): Uint8Array {
  const buf = new Uint8Array(20 + Math.max(payload.length, 10));
  buf.set([0x52, 0x49, 0x46, 0x46], 0); // RIFF
  buf.set([0x57, 0x45, 0x42, 0x50], 8); // WEBP
  buf.set([...chunk].map((c) => c.charCodeAt(0)), 12);
  buf.set(payload, 20);
  return buf;
}

function webpVp8x(width: number, height: number): Uint8Array {
  const w = width - 1;
  const h = height - 1;
  return riff("VP8X", [0, 0, 0, 0, w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff, h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff]);
}

function webpVp8l(width: number, height: number): Uint8Array {
  const bits = ((width - 1) & 0x3fff) | (((height - 1) & 0x3fff) << 14);
  return riff("VP8L", [0x2f, bits & 0xff, (bits >> 8) & 0xff, (bits >> 16) & 0xff, (bits >>> 24) & 0xff]);
}

function webpVp8(width: number, height: number): Uint8Array {
  return riff("VP8 ", [0x00, 0x00, 0x00, 0x9d, 0x01, 0x2a, width & 0xff, (width >> 8) & 0x3f, height & 0xff, (height >> 8) & 0x3f]);
}

describe("readImageDimensions", () => {
  it("PNG IHDR'den boyutu okur", () => {
    expect(readImageDimensions(png(1200, 800))).toEqual({ width: 1200, height: 800 });
    expect(readImageDimensions(png(100_000, 3))).toEqual({ width: 100_000, height: 3 });
  });

  it("JPEG'de DHT'yi atlayıp SOF0 ve progresif SOF2'den boyutu okur", () => {
    expect(readImageDimensions(jpeg(4032, 3024))).toEqual({ width: 4032, height: 3024 });
    expect(readImageDimensions(jpeg(640, 480, 0xc2))).toEqual({ width: 640, height: 480 });
  });

  it("JPEG'de SOF'tan önce SOS gelirse null döner", () => {
    const noFrame = new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02, 0x00]);
    expect(readImageDimensions(noFrame)).toBeNull();
  });

  it("WebP VP8X, VP8L ve VP8 başlıklarını okur", () => {
    expect(readImageDimensions(webpVp8x(9000, 7000))).toEqual({ width: 9000, height: 7000 });
    expect(readImageDimensions(webpVp8l(1024, 768))).toEqual({ width: 1024, height: 768 });
    expect(readImageDimensions(webpVp8(1920, 1080))).toEqual({ width: 1920, height: 1080 });
  });

  it("kısa ya da tanınmayan başlıkta null döner", () => {
    expect(readImageDimensions(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
    expect(readImageDimensions(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBeNull();
    expect(readImageDimensions(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(readImageDimensions(new Uint8Array(0))).toBeNull();
  });

  it("PNG imzası olup IHDR'si olmayan dosyada null döner", () => {
    const garbage = new Uint8Array(64);
    garbage.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    for (let i = 8; i < garbage.length; i++) garbage[i] = (i * 37) % 251;
    expect(readImageDimensions(garbage)).toBeNull();
  });
});
