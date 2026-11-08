import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { formatNotification } from "@/lib/notifications/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function redirectTo(request: Request, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url), { status: 303 });
}

/**
 * Bildirim listesinden tıklanan adres. Yalnız kendi bildirimi için: okundu yapar ve hedef sayfaya
 * yönlendirir. Başkasının ya da olmayan bir bildirim /bildirimler sayfasına döner ve hiçbir şey değişmez.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) {
    return redirectTo(request, `/giris?next=${encodeURIComponent(`/bildirimler/git/${encodeURIComponent(id)}`)}`);
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
    return redirectTo(request, "/bildirimler");
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
  return redirectTo(request, href);
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
