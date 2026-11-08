import { randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

// Şifre özeti: Node yerleşik scrypt (spec §8). Biçim: scrypt$N$r$p$saltB64$hashB64
const N = 16384;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;
const SALT_BYTES = 16;

// Doğrulamada saklı parametreler okunur; kötü niyetli bir değerle bellek/CPU tüketimini sınırla.
const MAX_N = 2 ** 17;
const MAX_R = 16;
const MAX_P = 4;
const MIN_KEY_LENGTH = 16;
const MAX_KEY_LENGTH = 128;

const MIN_PASSWORD_LENGTH = 10;
const MAX_PASSWORD_LENGTH = 128;

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keylen, options, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

function scryptMaxmem(n: number, r: number): number {
  // scrypt bellek kullanımı yaklaşık 128 * N * r bayttır; varsayılan sınır bunu aşınca hata verir.
  return 128 * n * r * 2;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scryptAsync(password, salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: scryptMaxmem(N, R),
  });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

function parsePositiveInt(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

/** Saklı özeti doğrular. Biçim bozuksa ya da hata olursa asla fırlatmaz; false döner. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;

    const n = parsePositiveInt(parts[1]);
    const r = parsePositiveInt(parts[2]);
    const p = parsePositiveInt(parts[3]);
    if (n === null || r === null || p === null) return false;
    if (n < 2 || (n & (n - 1)) !== 0 || n > MAX_N) return false;
    if (r > MAX_R || p > MAX_P) return false;

    const salt = Buffer.from(parts[4], "base64");
    const expected = Buffer.from(parts[5], "base64");
    if (salt.length === 0) return false;
    if (expected.length < MIN_KEY_LENGTH || expected.length > MAX_KEY_LENGTH) return false;

    const actual = await scryptAsync(password, salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: scryptMaxmem(n, r),
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Şifre kurallarını denetler. Geçerliyse null, değilse Türkçe hata metni döner. */
export function validatePasswordStrength(pw: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`;
  }
  if (pw.length > MAX_PASSWORD_LENGTH) {
    return `Şifre en fazla ${MAX_PASSWORD_LENGTH} karakter olabilir.`;
  }
  if (!/\p{L}/u.test(pw)) {
    return "Şifre en az bir harf içermeli.";
  }
  if (!/\d/.test(pw)) {
    return "Şifre en az bir rakam içermeli.";
  }
  return null;
}
