import clsx, { type ClassValue } from "clsx";

/** Koşullu sınıf adlarını birleştirir. Çakışan Tailwind sınıfları için kullanıcı, sınıfları sıralı yazar. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
