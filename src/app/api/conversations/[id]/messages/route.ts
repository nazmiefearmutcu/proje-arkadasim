import { NextResponse } from "next/server";
import { getCurrentUser, isVerified } from "@/lib/auth/guards";
import { getMessagesAfter } from "@/lib/messaging/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

/**
 * Açık sohbetin yeni mesajları: `?after=<ISO>` değerinden sonrakiler. Çağrı okundu işaretler.
 * Misafir 401, doğrulanmamış 403, katılımcı olmayan 404 alır.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401, headers });
  }
  if (!isVerified(user)) {
    return NextResponse.json({ error: "Bu işlem için belgeni doğrulaman gerekiyor." }, { status: 403, headers });
  }

  const { id } = await params;
  const raw = new URL(req.url).searchParams.get("after");
  const after = raw ? new Date(raw) : null;
  if (!after || Number.isNaN(after.getTime())) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400, headers });
  }

  const result = await getMessagesAfter(user.id, id, after);
  if (!result) {
    return NextResponse.json({ error: "Sohbet bulunamadı." }, { status: 404, headers });
  }

  return NextResponse.json(result, { headers });
}
