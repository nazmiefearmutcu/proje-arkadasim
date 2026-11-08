import { describe, expect, it } from "vitest";
import { assertSameOrigin, isSameOrigin } from "./origin";

function request(headers: Record<string, string>): Request {
  return new Request("https://proje-arkadasim.test/api/ornek", {
    method: "POST",
    headers,
  });
}

describe("isSameOrigin", () => {
  it("Origin başlığı yoksa izin verir", () => {
    expect(isSameOrigin(request({ host: "proje-arkadasim.test" }))).toBe(true);
  });

  it("Origin host'u istek host'uyla aynıysa izin verir", () => {
    expect(
      isSameOrigin(request({ host: "proje-arkadasim.test", origin: "https://proje-arkadasim.test" })),
    ).toBe(true);
  });

  it("Origin farklı bir host ise reddeder", () => {
    expect(
      isSameOrigin(request({ host: "proje-arkadasim.test", origin: "https://kotu.ornek" })),
    ).toBe(false);
  });

  it("bozuk Origin değerini reddeder", () => {
    expect(isSameOrigin(request({ host: "proje-arkadasim.test", origin: "null" }))).toBe(false);
  });

  it("x-forwarded-host ilk değerini kullanır", () => {
    expect(
      isSameOrigin(
        request({
          host: "ic-sunucu:3000",
          "x-forwarded-host": "proje-arkadasim.test, baska.ornek",
          origin: "https://proje-arkadasim.test",
        }),
      ),
    ).toBe(true);
  });
});

describe("assertSameOrigin", () => {
  it("eşleşmeyen kaynakta 403 JSON yanıtı fırlatır", () => {
    let thrown: unknown;
    try {
      assertSameOrigin(request({ host: "proje-arkadasim.test", origin: "https://kotu.ornek" }));
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(403);
  });
});
