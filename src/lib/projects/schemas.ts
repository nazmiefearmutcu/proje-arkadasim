import { z } from "zod";
import { CATEGORIES, CITIES, DISCIPLINE_GROUP_IDS, STAGES, WORK_MODES } from "@/config/taxonomy";

// Sunucu ve istemci aynı şemayı kullanır. Bu dosya sunucu içe aktarmaz (db, next/*).

const categoryValues = CATEGORIES.map((option) => option.value) as [string, ...string[]];
const stageValues = STAGES.map((option) => option.value) as [string, ...string[]];
const workModeValues = WORK_MODES.map((option) => option.value) as [string, ...string[]];

const categoryField = z.enum(categoryValues, { error: "Bir kategori seç." });
const stageField = z.enum(stageValues, { error: "Bir aşama seç." });
const workModeField = z.enum(workModeValues, { error: "Bir çalışma şekli seç." });
const disciplineField = z.enum(DISCIPLINE_GROUP_IDS, { error: "Bir disiplin seç." });

/** Boş ya da yalnız boşluk içeren şehir `null` olur. */
const cityField = z
  .string()
  .trim()
  .nullish()
  .transform((value) => (value ? value : null));

export const roleInputSchema = z.object({
  /** Mevcut rolün kimliği (düzenlemede). Yeni rollerde yoktur. */
  id: z.string().min(1).max(64).optional(),
  title: z
    .string()
    .trim()
    .min(3, { error: "Rol adı en az 3 karakter olmalı." })
    .max(60, { error: "Rol adı en fazla 60 karakter olabilir." }),
  disciplineGroup: disciplineField,
  slots: z
    .number({ error: "Kişi sayısı seçilmeli." })
    .int({ error: "Kişi sayısı tam sayı olmalı." })
    .min(1, { error: "En az 1 kişi aranmalı." })
    .max(5, { error: "En fazla 5 kişi aranabilir." }),
  description: z
    .string()
    .trim()
    .max(200, { error: "Rol açıklaması en fazla 200 karakter olabilir." })
    .default(""),
});

export type RoleInput = z.infer<typeof roleInputSchema>;

export const projectInputSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(8, { error: "Başlık en az 8 karakter olmalı." })
      .max(80, { error: "Başlık en fazla 80 karakter olabilir." }),
    summary: z
      .string()
      .trim()
      .min(20, { error: "Kısa özet en az 20 karakter olmalı." })
      .max(160, { error: "Kısa özet en fazla 160 karakter olabilir." }),
    description: z
      .string()
      .trim()
      .min(80, { error: "Açıklama en az 80 karakter olmalı." })
      .max(4000, { error: "Açıklama en fazla 4000 karakter olabilir." }),
    category: categoryField,
    stage: stageField,
    workMode: workModeField,
    city: cityField,
    tags: z
      .array(
        z
          .string()
          .trim()
          .min(2, { error: "Etiket en az 2 karakter olmalı." })
          .max(30, { error: "Etiket en fazla 30 karakter olabilir." }),
      )
      .max(8, { error: "En fazla 8 etiket ekleyebilirsin." })
      .default([]),
    roles: z
      .array(roleInputSchema)
      .min(1, { error: "En az bir rol ekle." })
      .max(6, { error: "En fazla 6 rol ekleyebilirsin." }),
  })
  .superRefine((value, ctx) => {
    if (value.workMode === "UZAKTAN") return;
    if (!value.city) {
      ctx.addIssue({ code: "custom", path: ["city"], message: "Yüz yüze ve hibrit projelerde şehir seçmelisin." });
      return;
    }
    if (!(CITIES as readonly string[]).includes(value.city)) {
      ctx.addIssue({ code: "custom", path: ["city"], message: "Listeden bir şehir seç." });
    }
  })
  .transform((value) => (value.workMode === "UZAKTAN" ? { ...value, city: null } : value));

/** Proje formunun çözümlenmiş hâli (şehir uzaktan çalışmada her zaman null). */
export type ProjectInput = z.infer<typeof projectInputSchema>;

export const applySchema = z.object({
  roleId: z
    .string()
    .trim()
    .nullish()
    .transform((value) => (value ? value : null)),
  message: z
    .string()
    .trim()
    .min(20, { error: "Motivasyon mesajı en az 20 karakter olmalı." })
    .max(1000, { error: "Mesaj en fazla 1000 karakter olabilir." }),
});

export const inviteSchema = z.object({
  projectId: z.string().min(1, { error: "Proje bulunamadı." }),
  username: z
    .string()
    .trim()
    .min(1, { error: "Kullanıcı adı gerekli." })
    .max(40, { error: "Kullanıcı adı en fazla 40 karakter olabilir." }),
  roleId: z
    .string()
    .trim()
    .nullish()
    .transform((value) => (value ? value : null)),
  message: z
    .string()
    .trim()
    .max(500, { error: "Davet mesajı en fazla 500 karakter olabilir." })
    .default(""),
});

export const projectStatusSchema = z.enum(["OPEN", "CLOSED"], { error: "Geçersiz proje durumu." });
