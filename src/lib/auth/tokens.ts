import { createHash, randomBytes } from "node:crypto";

/** Rastgele, URL'de güvenle taşınabilen (base64url) bir jeton üretir. */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Jetonun SHA-256 özetini (hex) döner. Veritabanında yalnız bu özet saklanır. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
