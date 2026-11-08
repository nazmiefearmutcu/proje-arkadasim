import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GENERIC_ERROR_MESSAGE,
  postDocument,
  readUploadResult,
  shouldRefreshAfter,
  stepsFor,
  UPLOAD_TIMEOUT_MS,
} from "./upload-flow";

afterEach(() => {
  vi.useRealTimers();
});

/** Hiç yanıt vermeyen sunucu: istek yalnız kesilince reddedilir. */
function hangingFetch() {
  return vi.fn(
    (_input: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }),
  ) as unknown as typeof fetch;
}

function jsonFetch(body: unknown, status = 200) {
  return vi.fn(async () => Response.json(body, { status })) as unknown as typeof fetch;
}

describe("stepsFor", () => {
  it("rıza varsa spec §4.2'deki rızalı akışı gösterir", () => {
    expect(stepsFor(true)).toEqual([
      "Belge okunuyor",
      "Kişisel veriler maskeleniyor",
      "Yapay zeka inceliyor",
      "Sonuç",
    ]);
  });

  it("rıza yoksa yapay zeka adımı yerine ekibin incelemesini söyler, diğer adımlar aynı kalır", () => {
    const steps = stepsFor(false);
    expect(steps).toEqual([
      "Belge okunuyor",
      "Kişisel veriler maskeleniyor",
      "Ekibimizin incelemesine hazırlanıyor",
      "Sonuç",
    ]);
    expect(steps.join(" ")).not.toMatch(/yapay zeka/i);
  });
});

describe("readUploadResult", () => {
  it("durum, mesaj ve hak yenme bilgisini okur", () => {
    expect(
      readUploadResult({ status: "REJECTED", message: "Güncel tarihli belge yükle.", consumedAttempt: true }),
    ).toEqual({ status: "REJECTED", message: "Güncel tarihli belge yükle.", consumedAttempt: true });
  });

  it("error alanını mesaj olarak kullanır; beklenmeyen gövde genel hata olur", () => {
    expect(readUploadResult({ error: "Dosya 10 MB'tan büyük olamaz." })).toEqual({
      status: "ERROR",
      message: "Dosya 10 MB'tan büyük olamaz.",
      consumedAttempt: false,
    });
    expect(readUploadResult(null)).toEqual({
      status: "ERROR",
      message: GENERIC_ERROR_MESSAGE,
      consumedAttempt: false,
    });
  });
});

describe("shouldRefreshAfter", () => {
  it("deneme hakkı yenen her sonuçta sayfayı yeniler: onay, ret ve manuel inceleme", () => {
    for (const status of ["APPROVED", "REJECTED", "MANUAL_REVIEW"]) {
      expect(shouldRefreshAfter({ status, message: "", consumedAttempt: true })).toBe(true);
    }
  });

  it("hak yenmeyen hatada yenilemez; zaten doğrulanmış hesapta yeniler", () => {
    expect(shouldRefreshAfter({ status: "ERROR", message: "", consumedAttempt: false })).toBe(false);
    expect(shouldRefreshAfter({ status: "MANUAL_REVIEW", message: "", consumedAttempt: false })).toBe(false);
    expect(shouldRefreshAfter({ status: "APPROVED", message: "", consumedAttempt: false })).toBe(true);
  });
});

describe("postDocument", () => {
  it("yanıtı okur ve zaman aşımı sayacını temizler", async () => {
    vi.useFakeTimers();
    const fetchImpl = jsonFetch({ status: "MANUAL_REVIEW", message: "İncelenecek.", consumedAttempt: true });
    const controller = new AbortController();

    const outcome = await postDocument(new FormData(), { controller, fetchImpl });

    expect(outcome).toEqual({
      kind: "result",
      result: { status: "MANUAL_REVIEW", message: "İncelenecek.", consumedAttempt: true },
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/verification",
      expect.objectContaining({ method: "POST", signal: controller.signal }),
    );
  });

  it("sunucu 90 sn içinde yanıt vermezse isteği keser ve 'aborted' döner", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const pending = postDocument(new FormData(), { controller, fetchImpl: hangingFetch() });

    await vi.advanceTimersByTimeAsync(UPLOAD_TIMEOUT_MS - 1);
    expect(controller.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    await expect(pending).resolves.toEqual({ kind: "aborted" });
    expect(controller.signal.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("çağıran isteği keserse (bileşen kapandı) sayaç temizlenir ve 'aborted' döner", async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    const pending = postDocument(new FormData(), { controller, fetchImpl: hangingFetch() });

    controller.abort();

    await expect(pending).resolves.toEqual({ kind: "aborted" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ağ hatasında genel hata sonucu döner", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    const outcome = await postDocument(new FormData(), { controller: new AbortController(), fetchImpl });

    expect(outcome).toEqual({
      kind: "result",
      result: { status: "ERROR", message: GENERIC_ERROR_MESSAGE, consumedAttempt: false },
    });
  });
});
