import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/cookie";
import { renewSessionByToken } from "@/lib/auth/renew";

// Kayan oturum yenilemesi veritabanı erişir; bu yüzden Node çalışma zamanında çalışır. Çerez
// yalnızca middleware (ve Server Action / Route Handler) yanıtında yazılabildiği için sayfa
// gezintisi de süreyi uzatır.
export const runtime = "nodejs";

export const config = {
  // Statik dosyalar, uygulama simgesi ve iki rota hariç her istek:
  // - /api/verification: Node middleware'i gövdeyi kopyalar ve varsayılan 10 MB sınırında keser; bu,
  //   MAX_DOCUMENT_BYTES'a eşit olduğu için sınıra yakın belgeler bozuk multipart'a dönüşürdü.
  // - /api/avatar: herkese açık, "immutable" önbelleğe alınan yanıtlara Set-Cookie eklenmemeli.
  // İki rota da oturumu kendisi okur (getCurrentUser).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/avatar|api/verification).*)"],
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
