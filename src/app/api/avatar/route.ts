import { avatarUrl } from "@/lib/avatar";
import { AVATAR_MAX_BYTES, AvatarError, deleteAvatarFile, removeUserAvatars, saveAvatar } from "@/lib/avatar-storage";
import { getCurrentUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { assertSameOrigin } from "@/lib/origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function errorResponse(message: string, status: number): Response {
  return Response.json({ ok: false, error: message }, { status, headers: NO_STORE });
}

/** Profil resmini yükler. Alan adı `avatar`; yanıt yeni adresi döner. */
export async function POST(req: Request): Promise<Response> {
  try {
    assertSameOrigin(req);
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }

  const user = await getCurrentUser();
  if (!user) return errorResponse("Fotoğraf yüklemek için giriş yapmalısın.", 401);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return errorResponse("Fotoğraf okunamadı. Dosyayı seçip tekrar dene.", 400);
  }

  const file = form.get("avatar");
  if (!(file instanceof File)) return errorResponse("Yüklemek için bir fotoğraf seç.", 400);
  if (file.size > AVATAR_MAX_BYTES) return errorResponse("Fotoğraf en fazla 2 MB olabilir.", 400);

  try {
    const name = await saveAvatar(user.id, new Uint8Array(await file.arrayBuffer()));
    await db.user.update({ where: { id: user.id }, data: { avatarPath: name } });
    return Response.json({ ok: true, url: avatarUrl(name) }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof AvatarError) return errorResponse(error.message, 400);
    return errorResponse("Fotoğraf kaydedilemedi. Birazdan tekrar dene.", 500);
  }
}

/** Profil resmini kaldırır: dosyayı siler ve profildeki yolu boşaltır. */
export async function DELETE(req: Request): Promise<Response> {
  try {
    assertSameOrigin(req);
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }

  const user = await getCurrentUser();
  if (!user) return errorResponse("Bu işlem için giriş yapmalısın.", 401);

  try {
    const current = await db.user.findUnique({ where: { id: user.id }, select: { avatarPath: true } });
    await deleteAvatarFile(current?.avatarPath);
    await removeUserAvatars(user.id);
    await db.user.update({ where: { id: user.id }, data: { avatarPath: null } });
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch {
    return errorResponse("Fotoğraf kaldırılamadı. Birazdan tekrar dene.", 500);
  }
}
