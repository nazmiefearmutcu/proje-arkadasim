import { getCurrentUser } from "@/lib/auth/guards";
import { buildAccountExport } from "@/lib/account-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Oturum açık kullanıcının verilerini JSON dosyası olarak indirir (KVKK m.11). */
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json(
      { ok: false, error: "Verilerini indirmek için giriş yapmalısın." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const now = new Date();
  const payload = await buildAccountExport(user.id, now);
  const day = now.toISOString().slice(0, 10);

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="proje-arkadasim-verilerim-${day}.json"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
