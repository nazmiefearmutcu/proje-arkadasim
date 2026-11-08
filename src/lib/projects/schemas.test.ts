import { describe, expect, it } from "vitest";
import { applySchema, inviteSchema, projectInputSchema, roleInputSchema } from "./schemas";

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    title: "Akıllı sera sulama sistemi",
    summary: "Toprak nemini ölçen ve sulamayı otomatik yöneten düşük maliyetli bir prototip.",
    description:
      "Bu projede toprak nemini ölçen sensörler ve sulama vanasını yöneten bir mikrodenetleyici kullanacağız. Ekip arkadaşlarından donanım ve veri tarafında destek bekliyoruz.",
    category: "DONANIM",
    stage: "PROTOTIP",
    workMode: "UZAKTAN",
    city: null,
    tags: ["arduino", "iot"],
    roles: [{ title: "Gömülü yazılımcı", disciplineGroup: "elektronik", slots: 1, description: "" }],
    ...overrides,
  };
}

describe("projectInputSchema", () => {
  it("geçerli uzaktan proje kabul edilir", () => {
    const result = projectInputSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it("yüz yüze projede şehir zorunludur", () => {
    const result = projectInputSchema.safeParse(validInput({ workMode: "YUZ_YUZE", city: null }));
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join(".") === "city")).toBe(true);
    }
  });

  it("hibrit projede şehir zorunludur ve listede olmalıdır", () => {
    expect(projectInputSchema.safeParse(validInput({ workMode: "HIBRIT", city: null })).success).toBe(false);
    expect(projectInputSchema.safeParse(validInput({ workMode: "HIBRIT", city: "Atlantis" })).success).toBe(false);
    expect(projectInputSchema.safeParse(validInput({ workMode: "HIBRIT", city: "İzmir" })).success).toBe(true);
  });

  it("uzaktan projede gönderilen şehir yok sayılır ve null olur", () => {
    const result = projectInputSchema.safeParse(validInput({ workMode: "UZAKTAN", city: "Ankara" }));
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.city).toBeNull();
  });

  it("etiket sayısı en fazla 8 olabilir", () => {
    const tags = Array.from({ length: 9 }, (_, index) => `etiket${index}`);
    expect(projectInputSchema.safeParse(validInput({ tags })).success).toBe(false);
    expect(projectInputSchema.safeParse(validInput({ tags: tags.slice(0, 8) })).success).toBe(true);
  });

  it("etiket uzunluğu 2 ile 30 karakter arasında olmalıdır", () => {
    expect(projectInputSchema.safeParse(validInput({ tags: ["a"] })).success).toBe(false);
    expect(projectInputSchema.safeParse(validInput({ tags: ["a".repeat(31)] })).success).toBe(false);
    expect(projectInputSchema.safeParse(validInput({ tags: ["ab"] })).success).toBe(true);
  });

  it("rol sayısı 1 ile 6 arasında olmalıdır", () => {
    expect(projectInputSchema.safeParse(validInput({ roles: [] })).success).toBe(false);
    const role = { title: "Tasarımcı", disciplineGroup: "tasarim", slots: 1, description: "" };
    expect(projectInputSchema.safeParse(validInput({ roles: Array(7).fill(role) })).success).toBe(false);
    expect(projectInputSchema.safeParse(validInput({ roles: Array(6).fill(role) })).success).toBe(true);
  });

  it("başlık 8 ile 80 karakter arasında olmalıdır", () => {
    expect(projectInputSchema.safeParse(validInput({ title: "Kısa" })).success).toBe(false);
    expect(projectInputSchema.safeParse(validInput({ title: "a".repeat(81) })).success).toBe(false);
  });

  it("taksonomi dışı kategori reddedilir", () => {
    expect(projectInputSchema.safeParse(validInput({ category: "UZAY" })).success).toBe(false);
  });
});

describe("roleInputSchema", () => {
  it("kişi sayısı 1 ile 5 arasında tam sayıdır", () => {
    const base = { title: "Pazarlamacı", disciplineGroup: "isletme", description: "" };
    expect(roleInputSchema.safeParse({ ...base, slots: 0 }).success).toBe(false);
    expect(roleInputSchema.safeParse({ ...base, slots: 6 }).success).toBe(false);
    expect(roleInputSchema.safeParse({ ...base, slots: 2.5 }).success).toBe(false);
    expect(roleInputSchema.safeParse({ ...base, slots: 5 }).success).toBe(true);
  });

  it("disiplin taksonomi kimliği olmalıdır", () => {
    const result = roleInputSchema.safeParse({
      title: "Pazarlamacı",
      disciplineGroup: "bilinmeyen",
      slots: 1,
      description: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("applySchema", () => {
  it("mesaj en az 20 karakter olmalıdır", () => {
    expect(applySchema.safeParse({ roleId: null, message: "Kısa mesaj" }).success).toBe(false);
    expect(applySchema.safeParse({ roleId: null, message: "Bu projede gerçekten katkı sunabilirim." }).success).toBe(true);
  });

  it("boş rol kimliği null olur", () => {
    const result = applySchema.safeParse({ roleId: "", message: "Bu projede gerçekten katkı sunabilirim." });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.roleId).toBeNull();
  });
});

describe("inviteSchema", () => {
  it("kullanıcı adı zorunludur, mesaj isteğe bağlıdır", () => {
    expect(inviteSchema.safeParse({ projectId: "p1", username: "  ", roleId: "", message: "" }).success).toBe(false);
    const result = inviteSchema.safeParse({ projectId: "p1", username: "ayse", roleId: "", message: "" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.roleId).toBeNull();
      expect(result.data.message).toBe("");
    }
  });
});
