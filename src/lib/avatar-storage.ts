import { randomBytes } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { sniffFileType } from "@/lib/verification/sniff";

// Profil resmi depolama (spec §4.10: en fazla 2 MB, JPEG/PNG/WebP). Dosya adı
// `<userId>-<8 hex>.<uzantı>` biçimindedir; yükleme her seferinde yeni ad verir, böylece
// önbelleğe alınmış eski adresler karışmaz.

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

// Testler AVATAR_DIR ortam değişkeniyle geçici bir klasöre yönlendirir.
export const AVATAR_DIR =
  process.env.AVATAR_DIR && process.env.AVATAR_DIR.trim().length > 0
    ? process.env.AVATAR_DIR.trim()
    : path.join(process.cwd(), "storage", "avatars");

export const AVATAR_FILE_PATTERN = /^[a-z0-9]+-[a-f0-9]{8}\.(jpg|png|webp)$/;

const EXTENSION = { jpeg: "jpg", png: "png", webp: "webp" } as const;
const CONTENT_TYPE = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" } as const;

/** Kullanıcıya gösterilebilecek (Türkçe) yükleme hatası. */
export class AvatarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AvatarError";
  }
}

/** Dosya adı yalnız bizim ürettiğimiz biçimdeyse true. Yol ayırıcı ve ".." içeremez. */
export function isAvatarFileName(name: string): boolean {
  if (name.includes("/") || name.includes("\\") || name.includes("..")) return false;
  return AVATAR_FILE_PATTERN.test(name);
}

/** Kullanıcının önceki tüm profil resimlerini siler (yoksa sessizce geçer). */
export async function removeUserAvatars(userId: string, keep?: string): Promise<void> {
  let names: string[];
  try {
    names = await readdir(AVATAR_DIR);
  } catch {
    return;
  }
  const prefix = `${userId}-`;
  await Promise.all(
    names
      .filter((name) => name.startsWith(prefix) && isAvatarFileName(name) && name !== keep)
      .map((name) => rm(path.join(AVATAR_DIR, name), { force: true })),
  );
}

/**
 * Resmi doğrular, diske yazar, kullanıcının önceki resmini siler ve yeni dosya adını döner.
 * Boyut ve tür denetimi sihirli baytlara dayanır; istemcinin gönderdiği MIME'a güvenilmez.
 */
export async function saveAvatar(userId: string, bytes: Uint8Array): Promise<string> {
  if (!/^[a-z0-9]+$/.test(userId)) {
    throw new AvatarError("Fotoğraf kaydedilemedi. Tekrar giriş yapıp dene.");
  }
  if (bytes.byteLength === 0) {
    throw new AvatarError("Seçtiğin dosya boş görünüyor.");
  }
  if (bytes.byteLength > AVATAR_MAX_BYTES) {
    throw new AvatarError("Fotoğraf en fazla 2 MB olabilir.");
  }
  const type = sniffFileType(bytes);
  if (type !== "jpeg" && type !== "png" && type !== "webp") {
    throw new AvatarError("Yalnızca JPEG, PNG veya WebP yükleyebilirsin.");
  }

  const fileName = `${userId}-${randomBytes(4).toString("hex")}.${EXTENSION[type]}`;
  await mkdir(AVATAR_DIR, { recursive: true });
  await writeFile(path.join(AVATAR_DIR, fileName), bytes, { flag: "wx" });
  await removeUserAvatars(userId, fileName);
  return fileName;
}

/** Adı verilen profil resmini siler. Geçersiz adı reddeder; yoksa hata vermez. */
export async function deleteAvatarFile(name: string | null | undefined): Promise<void> {
  if (!name) return;
  if (!isAvatarFileName(name)) {
    throw new AvatarError("Geçersiz dosya adı.");
  }
  await rm(path.join(AVATAR_DIR, name), { force: true });
}

/** Profil resmini okur. Ad geçersiz ya da dosya yoksa null. */
export async function readAvatarFile(
  name: string,
): Promise<{ bytes: ArrayBuffer; contentType: string } | null> {
  if (!isAvatarFileName(name)) return null;
  try {
    const buffer = await readFile(path.join(AVATAR_DIR, name));
    const bytes = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    const ext = name.slice(name.lastIndexOf(".") + 1) as keyof typeof CONTENT_TYPE;
    return { bytes, contentType: CONTENT_TYPE[ext] };
  } catch {
    return null;
  }
}
