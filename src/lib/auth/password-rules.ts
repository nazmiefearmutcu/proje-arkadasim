// Şifre kuralları saf fonksiyondur (Node modülü yok). Hem sunucu hem istemci formları kullanır.

export const MIN_PASSWORD_LENGTH = 10;
export const MAX_PASSWORD_LENGTH = 128;

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
