import { describe, expect, it } from "vitest";
import { verificationMode } from "./mode";

describe("verificationMode", () => {
  it("varsayılan editör modudur: belgeler editörlere gider", () => {
    expect(verificationMode({})).toBe("editor");
    expect(verificationMode({ VERIFICATION_MODE: "" })).toBe("editor");
  });

  it("yalnız açıkça \"ai\" seçilirse yapay zeka ön incelemesi açılır", () => {
    expect(verificationMode({ VERIFICATION_MODE: "ai" })).toBe("ai");
    expect(verificationMode({ VERIFICATION_MODE: " AI " })).toBe("ai");
  });

  it("tanınmayan değer güvenli tarafa, editör moduna düşer", () => {
    expect(verificationMode({ VERIFICATION_MODE: "auto" })).toBe("editor");
  });
});
