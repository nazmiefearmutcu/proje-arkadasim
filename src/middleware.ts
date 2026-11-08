import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/cookie";
import { renewSessionByToken } from "@/lib/auth/renew";

// Kayan oturum yenilemesi veritabanı erişir; bu yüzden Node çalışma zamanında çalışır. Çerez
// yalnızca middleware (ve Server Action / Route Handler) yanıtında yazılabildiği için sayfa
// gezintisi de süreyi uzatır.
export const runtime = "nodejs";

export const config = {
  // Statik dosyalar ve görseller hariç her istek.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next();
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return response;

  try {
    const outcome = await renewSessionByToken(token);
    if (outcome.kind === "renewed") {
      response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(outcome.expiresAt));
    } else if (outcome.kind === "expired" || outcome.kind === "none") {
      response.cookies.delete(SESSION_COOKIE);
    }
  } catch {
    // Veritabanı geçici olarak erişilemezse çerze dokunma; oturum okuması kendi hatasını yönetir.
  }
  return response;
}
