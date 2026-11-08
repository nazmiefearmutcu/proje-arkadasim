import { describe, expect, it } from "vitest";
import {
  forgotPasswordSchema,
  loginSchema,
  normalizeName,
  registerAccountSchema,
  registerSchema,
  resetPasswordSchema,
  usernameSchema,
} from "./schemas";

const ACCOUNT = {
  firstName: "Ayşe",
  lastName: "Öztürk",
  email: "ayse@ornek.com",
  username: "ayse.nur",
  password: "Guvenli2026pw",
  passwordRepeat: "Guvenli2026pw",
};

const CONSENTS = { privacyNotice: true, terms: true, crossBorderAi: false };

// Alan başına ilk mesajı alır; uygulamadaki zodFieldErrors ile aynı davranış.
function issuesOf(result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } }) {
  const out: Record<string, string> = {};
  if (result.success) return out;
  for (const issue of result.error?.issues ?? []) {
    const key = issue.path.map(String).join(".") || "_form";
    if (out[key] === undefined) out[key] = issue.message;
  }
  return out;
}

describe("ad ve soyad", () => {
  it("Türkçe harfleri kabul eder", () => {
    const result = registerAccountSchema.safeParse({ ...ACCOUNT, firstName: "Ğülşen", lastName: "Işıktürk" });
    expect(result.success).toBe(true);
  });

  it("kesme işareti ve tire içeren adları kabul eder", () => {
    const result = registerAccountSchema.safeParse({ ...ACCOUNT, firstName: "D'Arc", lastName: "Kaya-Demir" });
    expect(result.success).toBe(true);
  });

  it("rakam içeren adı reddeder", () => {
    const result = registerAccountSchema.safeParse({ ...ACCOUNT, firstName: "Ayşe1" });
    expect(issuesOf(result)).toHaveProperty("firstName");
  });

  it("boş adı 'gerekli' hatasıyla reddeder", () => {
    const result = registerAccountSchema.safeParse({ ...ACCOUNT, lastName: "   " });
    expect(issuesOf(result).lastName).toBe("Soyad gerekli.");
  });

  it("baş-son ve ardışık boşlukları temizler", () => {
    expect(normalizeName("  Ayşe    Nur  ")).toBe("Ayşe Nur");
  });
});

describe("kullanıcı adı", () => {
  it("büyük harfi küçültür ve geçerli adı kabul eder", () => {
    expect(usernameSchema.parse("Ali_Veli.99")).toBe("ali_veli.99");
  });

  it("üç karakterden kısa adı reddeder", () => {
    expect(usernameSchema.safeParse("ab").success).toBe(false);
  });

  it("nokta ile başlayan ya da biten adı reddeder", () => {
    expect(usernameSchema.safeParse(".ali").success).toBe(false);
    expect(usernameSchema.safeParse("ali.").success).toBe(false);
  });

  it("boşluk ve Türkçe harf içeren adı reddeder", () => {
    expect(usernameSchema.safeParse("ali veli").success).toBe(false);
    expect(usernameSchema.safeParse("şükrü").success).toBe(false);
  });

  it("ayrılmış adları reddeder", () => {
    for (const reserved of ["admin", "yonetim", "api", "giris", "kayit", "ayarlar", "destek", "proje", "projeler", "u"]) {
      expect(usernameSchema.safeParse(reserved).success, reserved).toBe(false);
    }
  });
});

describe("kayıt şemaları", () => {
  it("şifre tekrarı eşleşmezse hata verir", () => {
    const result = registerAccountSchema.safeParse({ ...ACCOUNT, passwordRepeat: "Baska2026pw" });
    expect(issuesOf(result).passwordRepeat).toBe("Şifreler eşleşmiyor.");
  });

  it("zayıf şifreyi kuralın Türkçe mesajıyla reddeder", () => {
    const result = registerAccountSchema.safeParse({ ...ACCOUNT, password: "kisa1", passwordRepeat: "kisa1" });
    expect(issuesOf(result).password).toBe("Şifre en az 10 karakter olmalı.");
  });

  it("aydınlatma ve kullanım koşulu onayı olmadan tam kaydı reddeder", () => {
    const result = registerSchema.safeParse({ ...ACCOUNT, ...CONSENTS, privacyNotice: false });
    expect(issuesOf(result)).toHaveProperty("privacyNotice");
  });

  it("açık rıza isteğe bağlıdır: işaretlenmese de tam kayıt geçerlidir", () => {
    const result = registerSchema.safeParse({ ...ACCOUNT, ...CONSENTS });
    expect(result.success).toBe(true);
  });

  it("e-postayı küçük harfe çevirir", () => {
    const result = registerAccountSchema.safeParse({ ...ACCOUNT, email: " Ayse@Ornek.COM " });
    expect(result.success && result.data.email).toBe("ayse@ornek.com");
  });
});

describe("giriş ve şifre sıfırlama şemaları", () => {
  it("giriş için e-posta ve şifre zorunludur", () => {
    expect(loginSchema.safeParse({ email: "", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "ayse@ornek.com", password: "x" }).success).toBe(true);
  });

  it("sıfırlama e-postası geçerli adres olmalıdır", () => {
    expect(forgotPasswordSchema.safeParse({ email: "gecersiz" }).success).toBe(false);
  });

  it("yeni şifre tekrarı eşleşmelidir", () => {
    const result = resetPasswordSchema.safeParse({ password: "Yeni2026sifre", passwordRepeat: "Yeni2026sifrx" });
    expect(issuesOf(result).passwordRepeat).toBe("Şifreler eşleşmiyor.");
  });
});
