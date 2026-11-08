// Oturum çerezinin adı ve seçenekleri. Çerez bu dosyada tanımlanır ki middleware (Node çalışma
// zamanı) next/headers'a ihtiyaç duymadan aynı adı ve seçenekleri kullanabilsin.

export const SESSION_COOKIE = "pa_session";

export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    expires,
  };
}
