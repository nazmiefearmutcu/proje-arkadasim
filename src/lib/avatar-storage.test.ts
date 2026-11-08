import { existsSync, readFileSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Geçici klasör: modül yüklenmeden önce ayarlanır (AVATAR_DIR modül düzeyinde okunur).
const TEST_DIR = vi.hoisted(() => {
  const dir = `.vitest-avatars-${Math.random().toString(36).slice(2, 10)}`;
  process.env.AVATAR_DIR = dir;
  return dir;
});

import {
  AVATAR_MAX_BYTES,
  AvatarError,
  deleteAvatarFile,
  isAvatarFileName,
  readAvatarFile,
  saveAvatar,
} from "./avatar-storage";

const USER_ID = "clu8w1x2y0000abcd1234efgh";
const OTHER_ID = "clo7z9a1b0001qrst5678uvwx";

function jpeg(size = 64): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0xff, 0xd8, 0xff, 0xe0]);
  return bytes;
}

function png(size = 64): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes;
}

function webp(size = 64): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  return bytes;
}

function filesInDir(): string[] {
  return existsSync(TEST_DIR) ? readdirSync(TEST_DIR).sort() : [];
}

describe("profil resmi depolama", () => {
  beforeEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it("görüntü olmayan baytları reddeder ve dosya yazmaz", async () => {
    const text = new TextEncoder().encode("bu bir metin dosyası, resim değil");
    await expect(saveAvatar(USER_ID, text)).rejects.toBeInstanceOf(AvatarError);
    expect(filesInDir()).toEqual([]);
  });

  it("2 MB'tan büyük dosyayı reddeder", async () => {
    const big = jpeg(AVATAR_MAX_BYTES + 1);
    await expect(saveAvatar(USER_ID, big)).rejects.toThrow("2 MB");
    expect(filesInDir()).toEqual([]);
  });

  it("JPEG, PNG ve WebP için doğru uzantılı ve kullanıcı önekli dosya adı üretir", async () => {
    const jpgName = await saveAvatar(USER_ID, jpeg());
    expect(jpgName).toMatch(/^clu8w1x2y0000abcd1234efgh-[a-f0-9]{8}\.jpg$/);
    expect(isAvatarFileName(jpgName)).toBe(true);

    const otherName = await saveAvatar(OTHER_ID, png());
    expect(otherName).toMatch(/^clo7z9a1b0001qrst5678uvwx-[a-f0-9]{8}\.png$/);

    const webpName = await saveAvatar(OTHER_ID, webp());
    expect(webpName.endsWith(".webp")).toBe(true);
  });

  it("aynı kullanıcının önceki resmini siler ve yalnız yenisini bırakır", async () => {
    const first = await saveAvatar(USER_ID, jpeg());
    const second = await saveAvatar(USER_ID, png());

    expect(second).not.toBe(first);
    expect(existsSync(path.join(TEST_DIR, first))).toBe(false);
    expect(existsSync(path.join(TEST_DIR, second))).toBe(true);
    expect(filesInDir()).toEqual([second]);
  });

  it("başka kullanıcının resmine dokunmaz", async () => {
    const mine = await saveAvatar(USER_ID, jpeg());
    const theirs = await saveAvatar(OTHER_ID, jpeg());

    await saveAvatar(USER_ID, png());

    expect(existsSync(path.join(TEST_DIR, theirs))).toBe(true);
    expect(existsSync(path.join(TEST_DIR, mine))).toBe(false);
  });

  it("yol gezinmesi içeren adları reddeder", async () => {
    await expect(deleteAvatarFile("../secret.png")).rejects.toBeInstanceOf(AvatarError);
    await expect(deleteAvatarFile("..\\secret.png")).rejects.toBeInstanceOf(AvatarError);
    expect(isAvatarFileName("../clu8w1x2y0000abcd1234efgh-1a2b3c4d.jpg")).toBe(false);
    expect(await readAvatarFile("../secret.png")).toBeNull();
  });

  it("EXIF (konum) meta verisini diske yazmadan önce atar", async () => {
    const exif = new TextEncoder().encode("Exif\0\0GPS-41.0082N-28.9784E");
    const app1 = [0xff, 0xe1, 0x00, exif.length + 2, ...exif];
    const scan = [0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 63, 0, 0x12, 0x34, 0xff, 0xd9];
    const photo = Uint8Array.from([0xff, 0xd8, ...app1, ...scan]);

    const name = await saveAvatar(USER_ID, photo);
    const stored = readFileSync(path.join(TEST_DIR, name));
    expect(stored.toString("latin1")).not.toContain("GPS-41.0082N");
    expect(stored.toString("latin1")).not.toContain("Exif");
    expect([...stored]).toEqual([0xff, 0xd8, ...scan]);
  });

  it("var olmayan dosyanın silinmesi hata vermez", async () => {
    await expect(deleteAvatarFile("clu8w1x2y0000abcd1234efgh-1a2b3c4d.jpg")).resolves.toBeUndefined();
    await expect(deleteAvatarFile(null)).resolves.toBeUndefined();
  });
});
