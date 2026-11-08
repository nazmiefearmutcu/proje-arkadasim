import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "./session";
import type { CurrentUser } from "./user-select";

export { currentUserSelect } from "./user-select";
export type { CurrentUser } from "./user-select";

/** Oturumdaki kullanıcıyı döner; giriş yoksa null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSessionUser();
  return session?.user ?? null;
}

export function isVerified(user: Pick<CurrentUser, "verificationStatus">): boolean {
  return user.verificationStatus === "VERIFIED";
}

/**
 * Yönetici yalnız `role` ADMIN olan hesaplardır. ADMIN_EMAILS çalışma zamanında yetki vermez:
 * kayıtta e-posta sahipliği doğrulanmadığı için operatörün adresini önceden kaydeden biri
 * yönetici olabilirdi. Yöneticiler tohum verisi ya da operatör işlemiyle role ADMIN yapılır.
 */
export function isAdmin(user: Pick<CurrentUser, "role">): boolean {
  return user.role === "ADMIN";
}

function loginPath(next?: string): string {
  const target = safeNextPath(next, "");
  return target ? `/giris?next=${encodeURIComponent(target)}` : "/giris";
}

/** Giriş zorunlu. Yoksa `/giris` sayfasına yönlendirir (bitiş adresi `next` ile korunur). */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect(loginPath(next));
  return user;
}

/** Giriş ve belge doğrulaması zorunlu. Doğrulanmamışsa `/dogrulama` sayfasına yönlendirir. */
export async function requireVerified(next?: string): Promise<CurrentUser> {
  const user = await requireUser(next);
  if (!isVerified(user)) redirect("/dogrulama");
  return user;
}

/** Yönetici değilse 404 döner (yönetim alanının varlığını gizler). */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user)) notFound();
  return user;
}

/**
 * Açık yönlendirmeyi engeller. Yalnız tek "/" ile başlayan iç yollara izin verilir;
 * "//", "/\", kontrol karakterleri ve mutlak adresler reddedilir.
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (typeof next !== "string") return fallback;
  if (next.length === 0 || next.length > 2048) return fallback;
  if (!next.startsWith("/")) return fallback;
  if (next.startsWith("//")) return fallback;
  if (next.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  return next;
}
