import { getCurrentUser } from "@/lib/auth/guards";
import { assertSameOrigin } from "@/lib/origin";
import { verifyDocument } from "@/lib/verification/service";
import { MAX_DOCUMENT_BYTES } from "@/lib/verification/sniff";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

// Çok parçalı gövdeye (multipart) ek pay: alan adları ve sınır metni için 64 KB.
const BODY_OVERHEAD_BYTES = 64 * 1024;

const TOO_LARGE_MESSAGE = "Dosya 10 MB'tan büyük olamaz.";
const NO_FILE_MESSAGE = "Yüklenecek bir belge seçmedin.";
const GENERIC_ERROR_MESSAGE = "Belge şu an işlenemedi. Birazdan tekrar dene.";
const IN_REVIEW_MESSAGE = "Belgen zaten inceleniyor. İnceleme bitene kadar yeni belge yükleyemezsin.";

/**
 * Belge yükleme ve doğrulama. Dosya, istek bitene kadar yalnızca bellekte tutulur; adı ve içeriği
 * hiçbir yerde loglanmaz. Yanıt: { status, message, consumedAttempt }.
 */
export async function POST(req: Request): Promise<Response> {
  try {
    assertSameOrigin(req);
  } catch (error) {
    if (error instanceof Response) return error;
    throw error;
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Önce giriş yapmalısın." }, { status: 401 });
  }

  // İnceleme bekleyen hesap ikinci belge yükleyemez; eski bir sekmeden gelen istek de burada durur.
  if (user.verificationStatus === "MANUAL_REVIEW") {
    return Response.json(
      { status: "MANUAL_REVIEW", message: IN_REVIEW_MESSAGE, consumedAttempt: false },
      { status: 409 },
    );
  }

  // Gövde okunmadan önce boyut sınırı: büyük istekler belleğe alınmaz.
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_DOCUMENT_BYTES + BODY_OVERHEAD_BYTES) {
    return Response.json({ error: TOO_LARGE_MESSAGE }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: NO_FILE_MESSAGE }, { status: 400 });
  }

  const file = form.get("belge");
  if (!(file instanceof File)) {
    return Response.json({ error: NO_FILE_MESSAGE }, { status: 400 });
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return Response.json({ error: TOO_LARGE_MESSAGE }, { status: 413 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const outcome = await verifyDocument({ userId: user.id, bytes });
    return Response.json({
      status: outcome.status,
      message: outcome.message,
      consumedAttempt: outcome.consumedAttempt,
    });
  } catch {
    return Response.json(
      { status: "ERROR", message: GENERIC_ERROR_MESSAGE, consumedAttempt: false },
      { status: 500 },
    );
  }
}
