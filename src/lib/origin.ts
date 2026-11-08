/**
 * Origin başlığı varsa, host'u istek host'uyla aynı mı diye bakar. Başlık yoksa (sunucu
 * tarafı ya da eski tarayıcılar) izin verir; başlık varsa ve eşleşmiyorsa ya da bozuksa reddeder.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (origin === null) return true;

  const rawHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const host = rawHost.split(",")[0]?.trim().toLowerCase() ?? "";
  if (host.length === 0) return false;

  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

/** Mutasyon route handler'larında çağrılır. Kaynak eşleşmezse 403 JSON yanıtı fırlatır. */
export function assertSameOrigin(req: Request): void {
  if (!isSameOrigin(req)) {
    throw Response.json({ error: "İstek kaynağı doğrulanamadı." }, { status: 403 });
  }
}
