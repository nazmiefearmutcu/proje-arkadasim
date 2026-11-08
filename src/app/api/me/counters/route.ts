import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { getCounters } from "@/lib/counters";
import { maybeRunPurge } from "@/lib/purge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Oturum açık kullanıcının rozet sayıları. Misafir için yalnız `authenticated: false` döner. */
export async function GET() {
  const user = await getCurrentUser();
  const headers = { "Cache-Control": "no-store" };

  if (!user) {
    return NextResponse.json({ authenticated: false }, { headers });
  }

  const counters = await getCounters(user.id);
  const response = NextResponse.json({ authenticated: true, ...counters }, { headers });
  // Saklama temizliği yanıtı beklemez ve hata fırlatmaz (saatte en fazla bir kez).
  maybeRunPurge();
  return response;
}
