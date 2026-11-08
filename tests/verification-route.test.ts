import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_DOCUMENT_BYTES } from "@/lib/verification/sniff";

// Oturum ve belge hattı taklit edilir: bu testler yalnızca route'un HTTP sözleşmesini sınar.
const session = vi.hoisted(() => ({
  user: null as null | { id: string; verificationStatus?: string },
}));
const verify = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/guards", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/guards")>();
  return { ...actual, getCurrentUser: async () => session.user };
});

vi.mock("@/lib/verification/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/verification/service")>();
  return { ...actual, verifyDocument: verify };
});

import { POST } from "@/app/api/verification/route";

const SAME_ORIGIN = "http://proje.test";
const HOST = "proje.test";

function pdfFile(size = 64): File {
  const header = new TextEncoder().encode("%PDF-1.7\n");
  const bytes = new Uint8Array(size);
  bytes.set(header.subarray(0, Math.min(header.length, size)));
  return new File([bytes], "belge.pdf", { type: "application/pdf" });
}

function buildRequest(options: {
  file?: File | null;
  origin?: string | null;
  contentLength?: string;
}): Request {
  const form = new FormData();
  if (options.file) form.append("belge", options.file);
  const headers: Record<string, string> = { host: HOST };
  if (options.origin !== null) headers.origin = options.origin ?? SAME_ORIGIN;
  if (options.contentLength) headers["content-length"] = options.contentLength;
  return new Request("http://proje.test/api/verification", {
    method: "POST",
    headers,
    body: form,
  });
}

beforeEach(() => {
  session.user = { id: "user-1" };
  verify.mockReset();
  verify.mockResolvedValue({
    status: "MANUAL_REVIEW",
    message: "Belgen ekibimiz tarafından incelenecek.",
    consumedAttempt: true,
    processingMs: 3,
  });
});

describe("POST /api/verification", () => {
  it("başka bir kaynaktan gelen isteği 403 ile reddeder", async () => {
    const response = await POST(
      buildRequest({ file: pdfFile(), origin: "https://kotu.example" }),
    );

    expect(response.status).toBe(403);
    expect(verify).not.toHaveBeenCalled();
  });

  it("giriş yapılmamışsa 401 JSON döner", async () => {
    session.user = null;

    const response = await POST(buildRequest({ file: pdfFile() }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Önce giriş yapmalısın." });
    expect(verify).not.toHaveBeenCalled();
  });

  it("belge alanı yoksa 400 JSON döner", async () => {
    const response = await POST(buildRequest({ file: null }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
    expect(verify).not.toHaveBeenCalled();
  });

  it("gövde boyutu sınırı aşarsa gövde okunmadan 413 döner", async () => {
    const tooLarge = String(MAX_DOCUMENT_BYTES + 64 * 1024 + 1);

    const response = await POST(buildRequest({ file: pdfFile(), contentLength: tooLarge }));

    expect(response.status).toBe(413);
    expect(verify).not.toHaveBeenCalled();
  });

  it("inceleme bekleyen hesap ikinci belge yükleyemez: 409 döner, doğrulama çalışmaz", async () => {
    session.user = { id: "user-1", verificationStatus: "MANUAL_REVIEW" };

    const response = await POST(buildRequest({ file: pdfFile() }));

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ status: "MANUAL_REVIEW", consumedAttempt: false });
    expect(verify).not.toHaveBeenCalled();
  });

  it("geçerli bir belgeyi doğrulayıp sonucu JSON olarak döner", async () => {
    const response = await POST(buildRequest({ file: pdfFile() }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "MANUAL_REVIEW",
      message: "Belgen ekibimiz tarafından incelenecek.",
      consumedAttempt: true,
    });
    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify.mock.calls[0][0]).toMatchObject({ userId: "user-1" });
  });

  it("beklenmeyen hata 500 ile genel ERROR mesajı döner", async () => {
    verify.mockRejectedValueOnce(new Error("iç hata ayrıntısı"));

    const response = await POST(buildRequest({ file: pdfFile() }));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      status: "ERROR",
      message: "Belge şu an işlenemedi. Birazdan tekrar dene.",
      consumedAttempt: false,
    });
    expect(JSON.stringify(body)).not.toContain("iç hata ayrıntısı");
  });
});
