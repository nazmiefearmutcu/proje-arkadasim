import { z } from "zod";
import { validatePasswordStrength } from "./password-rules";

// Kimlik formlarının doğrulama şemaları. Saf modül: istemci formları da kullanır (Node modülü yok).

/** Kullanıcı adı olarak alınamayan adlar (yol ve rota çakışmasını önler). */
export const RESERVED_USERNAMES = [
  "admin",
  "yonetim",
  "api",
  "giris",
  "kayit",
  "ayarlar",
  "destek",
  "proje",
  "projeler",
  "u",
] as const;

export const USERNAME_PATTERN = /^[a-z0-9_.]+$/;

// Harf ile başlar ve biter; arada harf, boşluk, tire ve kesme işareti olabilir.
const NAME_PATTERN = /^\p{L}[\p{L}'’\- ]*\p{L}$/u;

/** Ad ve soyadı: baş-son boşlukları kırpar, ardışık boşlukları tek boşluğa indirir. */
export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function nameField(label: string) {
  return z
    .string({ error: `${label} gerekli.` })
    .transform(normalizeName)
    .pipe(
      z
        .string()
        .min(1, { message: `${label} gerekli.` })
        .min(2, { message: `${label} en az 2 karakter olmalı.` })
        .max(40, { message: `${label} en fazla 40 karakter olabilir.` })
        .regex(NAME_PATTERN, {
          message: `${label} yalnızca harf, boşluk, tire ve kesme işareti içerebilir.`,
        }),
    );
}

export const usernameSchema = z
  .string({ error: "Kullanıcı adı gerekli." })
  .transform((value) => value.trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(1, { message: "Kullanıcı adı gerekli." })
      .min(3, { message: "Kullanıcı adı en az 3 karakter olmalı." })
      .max(20, { message: "Kullanıcı adı en fazla 20 karakter olabilir." })
      .regex(USERNAME_PATTERN, {
        message: "Kullanıcı adı yalnızca küçük harf, rakam, alt çizgi (_) ve nokta (.) içerebilir.",
      })
      .refine((value) => !value.startsWith(".") && !value.endsWith("."), {
        message: "Kullanıcı adı nokta ile başlayamaz veya bitemez.",
      })
      .refine((value) => !(RESERVED_USERNAMES as readonly string[]).includes(value), {
        message: "Bu kullanıcı adı kullanılamaz.",
      }),
  );

export const emailSchema = z
  .string({ error: "E-posta gerekli." })
  .trim()
  .toLowerCase()
  .min(1, { message: "E-posta gerekli." })
  .max(254, { message: "E-posta en fazla 254 karakter olabilir." })
  .pipe(z.email({ message: "Geçerli bir e-posta adresi yaz." }));

const passwordField = z.string({ error: "Şifre gerekli." }).superRefine((value, ctx) => {
  const problem = validatePasswordStrength(value);
  if (problem) ctx.addIssue({ code: "custom", message: problem });
});

/** Hesap alanları (kayıt adımı 1). Şifre tekrarı eşleşmesi aşağıda, her şemada ayrıca denetlenir. */
const accountBase = z.object({
  firstName: nameField("Ad"),
  lastName: nameField("Soyad"),
  email: emailSchema,
  username: usernameSchema,
  password: passwordField,
  passwordRepeat: z.string({ error: "Şifreyi tekrar yaz." }),
});

/** Kayıt adım 1: yalnızca hesap alanları. İstemci, adım 2'ye geçmeden bunu çalıştırır. */
export const registerAccountSchema = accountBase.superRefine((value, ctx) => {
  if (value.password !== value.passwordRepeat) {
    ctx.addIssue({ code: "custom", path: ["passwordRepeat"], message: "Şifreler eşleşmiyor." });
  }
});

/** Tam kayıt: hesap alanları ve onaylar. Açık rıza (crossBorderAi) isteğe bağlıdır. */
export const registerSchema = accountBase
  .extend({
    privacyNotice: z.boolean().refine((value) => value === true, {
      message: "Aydınlatma metnini okuduğunu onaylaman gerekiyor.",
    }),
    terms: z.boolean().refine((value) => value === true, {
      message: "Kullanım koşullarını kabul etmen gerekiyor.",
    }),
    crossBorderAi: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.passwordRepeat) {
      ctx.addIssue({ code: "custom", path: ["passwordRepeat"], message: "Şifreler eşleşmiyor." });
    }
  });

export const loginSchema = z.object({
  email: z
    .string({ error: "E-posta gerekli." })
    .trim()
    .toLowerCase()
    .min(1, { message: "E-posta gerekli." })
    .max(254, { message: "E-posta en fazla 254 karakter olabilir." }),
  password: z
    .string({ error: "Şifre gerekli." })
    .min(1, { message: "Şifre gerekli." })
    .max(128, { message: "Şifre en fazla 128 karakter olabilir." }),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    password: passwordField,
    passwordRepeat: z.string({ error: "Şifreyi tekrar yaz." }),
  })
  .superRefine((value, ctx) => {
    if (value.password !== value.passwordRepeat) {
      ctx.addIssue({ code: "custom", path: ["passwordRepeat"], message: "Şifreler eşleşmiyor." });
    }
  });

export type RegisterAccountInput = z.infer<typeof registerAccountSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
