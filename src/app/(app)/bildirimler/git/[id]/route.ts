import { getCurrentUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { formatNotification } from "@/lib/notifications/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Göreli 303 yönlendirmesi. Mutlak adres `request.url` üzerinden kurulmaz: kendi sunucusunda ya da
 * Location'ı yeniden yazmayan bir vekil arkasında `request.url` iç adres (http://localhost:<port>) olur
 * ve her dokunuş o adrese giderdi. Tarayıcı göreli Location'ı isteğin adresine göre çözer.
 * Yalnız "/" ile başlayan site içi yollar kabul edilir ("//" ile başlayan başka siteye gidebilir).
 */
function redirectTo(path: string): Response {
  const safePath = path.startsWith("/") && !path.startsWith("//") ? path : "/bildirimler";
  return new Response(null, { status: 303, headers: { Location: safePath } });
}

/**
 * Önceden getirme (prefetch) isteği mi? Next.js yönlendiricisi `Next-Router-Prefetch: 1` gönderir;
 * tarayıcı önceden getirmeleri `Sec-Purpose` / `Purpose` başlığında "prefetch" taşır.
 * Bu istekler bildirimi okundu yapmamalı: spec §4.8'e göre bildirim dokununca okundu olur.
 * (Dışa aktarılmaz: rota dosyası yalnız Next.js'in tanıdığı adları dışa aktarabilir.)
 */
function isPrefetchRequest(request: Request): boolean {
  if (request.headers.get("next-router-prefetch") === "1") return true;
  const purpose = `${request.headers.get("sec-purpose") ?? ""} ${request.headers.get("purpose") ?? ""}`;
  return purpose.toLowerCase().includes("prefetch");
}

/**
 * Bildirim listesinden tıklanan adres. Yalnız kendi bildirimi için: okundu yapar ve hedef sayfaya
 * yönlendirir. Başkasının ya da olmayan bir bildirim /bildirimler sayfasına döner ve hiçbir şey değişmez.
 * Önceden getirme isteklerine 204 döner; hiçbir şey değişmez.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (isPrefetchRequest(request)) {
    return new Response(null, { status: 204 });
  }

  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return redirectTo(`/giris?next=${encodeURIComponent(`/bildirimler/git/${encodeURIComponent(id)}`)}`);
  }

  const row = await db.notification.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      type: true,
      dataJson: true,
      conversationId: true,
      actor: { select: { firstName: true, lastName: true, username: true } },
      project: { select: { id: true, title: true } },
    },
  });
  if (!row || row.userId !== user.id) {
    return redirectTo("/bildirimler");
  }

  // Yalnız okunmamış satır güncellenir; zaten okunmuş bildirimin okunma zamanı korunur.
  await db.notification.updateMany({
    where: { id: row.id, userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  const { href } = formatNotification({
    type: row.type,
    data: parseData(row.dataJson),
    actor: row.actor,
    project: row.project,
    conversationId: row.conversationId,
  });
  return redirectTo(href);
}

function parseData(json: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(json);
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}
