import { readAvatarFile } from "@/lib/avatar-storage";

export const runtime = "nodejs";

/**
 * Profil resmini sunar. Adresler yüklemeyle birlikte değiştiği için uzun süreli önbellek güvenlidir.
 * Ad biçimi doğrulanır; yol gezinmesi ve bilinmeyen dosyalar 404 döner.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ file: string }> },
): Promise<Response> {
  const { file } = await params;
  const loaded = await readAvatarFile(file);
  if (!loaded) {
    return new Response(null, { status: 404, headers: { "X-Content-Type-Options": "nosniff" } });
  }
  return new Response(loaded.bytes, {
    status: 200,
    headers: {
      "Content-Type": loaded.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
