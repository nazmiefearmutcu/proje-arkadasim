import { describe, expect, it } from "vitest";
import { MAX_DOCUMENT_BYTES, sniffFileType } from "./sniff";

const bytes = (...values: number[]) => new Uint8Array(values);

describe("sniffFileType", () => {
  it("PDF'i %PDF- sihirli değeriyle tanır", () => {
    expect(sniffFileType(new TextEncoder().encode("%PDF-1.7\n%âãÏÓ"))).toBe("pdf");
  });

  it("JPEG'i FF D8 FF ile tanır", () => {
    expect(sniffFileType(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00))).toBe("jpeg");
  });

  it("PNG'yi 8 baytlık imzasıyla tanır", () => {
    expect(sniffFileType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00))).toBe("png");
  });

  it("WebP'yi RIFF ... WEBP yapısıyla tanır", () => {
    const webp = new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 ");
    expect(sniffFileType(webp)).toBe("webp");
  });

  it("RIFF olup WEBP olmayan dosyayı (ör. WAV) reddeder", () => {
    const wav = new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WAVEfmt ");
    expect(sniffFileType(wav)).toBeNull();
  });

  it("tanınmayan rastgele baytları null döndürür", () => {
    expect(sniffFileType(bytes(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12))).toBeNull();
  });

  it("boş dizi için null döndürür", () => {
    expect(sniffFileType(new Uint8Array(0))).toBeNull();
  });

  it("yalnızca başlık kalmış kısa diziyi tanır, daha kısasını reddeder", () => {
    expect(sniffFileType(bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull();
    expect(sniffFileType(bytes(0xff, 0xd8))).toBeNull();
    expect(sniffFileType(new TextEncoder().encode("%PDF"))).toBeNull();
  });

  it("maksimum belge boyutu 10 MB'tır", () => {
    expect(MAX_DOCUMENT_BYTES).toBe(10 * 1024 * 1024);
  });
});
