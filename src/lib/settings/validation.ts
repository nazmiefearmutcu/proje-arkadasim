import { z } from "zod";
import { CITIES, DEGREE_LEVELS } from "@/config/taxonomy";
import { zodFieldErrors } from "@/lib/action-result";
import { parseList, toListJson } from "@/lib/json-fields";
import {
  BIO_MAX,
  CLASS_YEAR_MAX,
  DEPARTMENT_MAX,
  FACULTY_MAX,
  GRADUATION_YEAR_MIN,
  INTERESTS_MAX,
  ITEM_MAX,
  SKILLS_MAX,
} from "./limits";

// Ayarlar formlarının doğrulaması. Dosya bir Server Action dosyası olmadığı için sabitler ve
// yardımcılar burada tutulur (`"use server"` dosyaları yalnızca asenkron fonksiyon dışa aktarabilir).

const CITY_SET = new Set<string>(CITIES);
const DEGREE_SET = new Set<string>(DEGREE_LEVELS.map((level) => level.value));

export interface ProfileData {
  bio: string | null;
  city: string | null;
  skills: string[];
  interests: string[];
  lookingForProject: boolean;
  faculty: string | null;
  department: string | null;
  degreeLevel: string | null;
  classYear: number | null;
  graduationYear: number | null;
}

export type ProfileParseResult =
  | { ok: true; data: ProfileData }
  | { ok: false; error: string; fieldErrors: Record<string, string> };

export function readText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Gizli JSON alanından metin listesi okur. Bozuk değer boş liste sayılır. */
export function readList(formData: FormData, key: string): string[] {
  const raw = readText(formData, key);
  if (raw.trim().length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

/** Boş metin null; tam sayı olmayan girdi NaN (zod bunu geçersiz sayar). */
function readYear(formData: FormData, key: string): number | null {
  const raw = readText(formData, key).trim();
  if (raw.length === 0) return null;
  const value = Number(raw);
  return Number.isInteger(value) ? value : Number.NaN;
}

/**
 * Profil formunu doğrular. Doğrulanmamış kullanıcı için eğitim alanları hiç okunmaz; böylece
 * formda gelen değerler kayda geçmez. Üniversite, ad ve soyad bu şemanın kapsamında değildir.
 */
export function parseProfileForm(
  formData: FormData,
  options: { verified: boolean; academicStatus: string | null; now?: Date },
): ProfileParseResult {
  const currentYear = (options.now ?? new Date()).getFullYear();
  const graduates = options.academicStatus === "GRADUATE";

  const base = z.object({
    bio: z.string().trim().max(BIO_MAX, { message: `Biyografi en fazla ${BIO_MAX} karakter olabilir.` }),
    city: z
      .string()
      .trim()
      .refine((value) => value === "" || CITY_SET.has(value), { message: "Listeden bir şehir seç." }),
    skills: z
      .array(z.string().trim().min(1).max(ITEM_MAX))
      .max(SKILLS_MAX, { message: `En fazla ${SKILLS_MAX} beceri ekleyebilirsin.` }),
    interests: z
      .array(z.string().trim().min(1).max(ITEM_MAX))
      .max(INTERESTS_MAX, { message: `En fazla ${INTERESTS_MAX} ilgi alanı ekleyebilirsin.` }),
    lookingForProject: z.boolean(),
  });

  const academic = z
    .object({
      faculty: z.string().trim().max(FACULTY_MAX, { message: `Fakülte adı en fazla ${FACULTY_MAX} karakter olabilir.` }),
      department: z
        .string()
        .trim()
        .max(DEPARTMENT_MAX, { message: `Bölüm adı en fazla ${DEPARTMENT_MAX} karakter olabilir.` }),
      degreeLevel: z
        .string()
        .trim()
        .refine((value) => value === "" || DEGREE_SET.has(value), { message: "Listeden bir öğrenim düzeyi seç." }),
      classYear: z
        .number({ message: "Sınıfını seç." })
        .int({ message: "Sınıfını seç." })
        .min(1, { message: "Sınıfını seç." })
        .max(CLASS_YEAR_MAX, { message: "Sınıfını seç." })
        .nullable(),
      graduationYear: z
        .number({ message: "Mezuniyet yılını rakamla yaz (ör. 2023)." })
        .int({ message: "Mezuniyet yılını rakamla yaz (ör. 2023)." })
        .min(GRADUATION_YEAR_MIN, { message: `Mezuniyet yılı ${GRADUATION_YEAR_MIN} sonrası olmalı.` })
        .max(currentYear + 1, { message: "Mezuniyet yılı gelecekte olamaz." })
        .nullable(),
    })
    .superRefine((value, ctx) => {
      if (graduates && value.graduationYear === null) {
        ctx.addIssue({ code: "custom", path: ["graduationYear"], message: "Mezuniyet yılını yaz (ör. 2023)." });
      }
      if (!graduates && value.classYear === null) {
        ctx.addIssue({ code: "custom", path: ["classYear"], message: "Sınıfını seç." });
      }
    });

  const rawBase = {
    bio: readText(formData, "bio"),
    city: readText(formData, "city"),
    skills: readList(formData, "skills").map((item) => item.trim()).filter((item) => item.length > 0),
    interests: readList(formData, "interests").map((item) => item.trim()).filter((item) => item.length > 0),
    lookingForProject: formData.get("lookingForProject") === "on",
  };

  const baseResult = base.safeParse(rawBase);
  const academicResult = options.verified
    ? academic.safeParse({
        faculty: readText(formData, "faculty"),
        department: readText(formData, "department"),
        degreeLevel: readText(formData, "degreeLevel"),
        classYear: graduates ? null : readYear(formData, "classYear"),
        graduationYear: graduates ? readYear(formData, "graduationYear") : null,
      })
    : null;

  const issues: Record<string, string> = {};
  if (!baseResult.success) Object.assign(issues, zodFieldErrors(baseResult.error));
  if (academicResult && !academicResult.success) {
    for (const [key, message] of Object.entries(zodFieldErrors(academicResult.error))) {
      issues[key] ??= message;
    }
  }
  if (Object.keys(issues).length > 0) {
    return { ok: false, error: "Bilgilerini kontrol et.", fieldErrors: issues };
  }
  if (!baseResult.success) return { ok: false, error: "Bilgilerini kontrol et.", fieldErrors: {} };

  const b = baseResult.data;
  const a = academicResult?.success ? academicResult.data : null;
  return {
    ok: true,
    data: {
      bio: b.bio.length > 0 ? b.bio : null,
      city: b.city.length > 0 ? b.city : null,
      skills: parseList(toListJson(b.skills, SKILLS_MAX)),
      interests: parseList(toListJson(b.interests, INTERESTS_MAX)),
      lookingForProject: b.lookingForProject,
      faculty: a && a.faculty.length > 0 ? a.faculty : null,
      department: a && a.department.length > 0 ? a.department : null,
      degreeLevel: a && a.degreeLevel.length > 0 ? a.degreeLevel : null,
      classYear: a?.classYear ?? null,
      graduationYear: a?.graduationYear ?? null,
    },
  };
}

/** Şifre değişimi alanlarındaki hatalar (zorunluluk ve eşleşme). Güç denetimi ayrıca yapılır. */
export const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, { message: "Mevcut şifreni yaz." }),
  newPassword: z.string().min(1, { message: "Yeni şifreni yaz." }),
  newPasswordRepeat: z.string(),
});

export const deleteAccountSchema = z.object({
  password: z.string().min(1, { message: "Şifreni yaz." }),
  usernameConfirm: z.string().trim(),
});
