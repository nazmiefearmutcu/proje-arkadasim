// Şikayet nedenleri ve hedef türleri. Hem sunucu eylemi hem istemci formu bu sabitleri kullanır.
// Bu dosya yalnız sabit içerir ('use server' dosyası olmadığı için istemciden içe aktarılabilir).

export const REPORT_TARGET_TYPES = ["USER", "PROJECT", "MESSAGE"] as const;
export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

export const REPORT_REASONS = [
  "Sahte belge veya kimlik",
  "Spam veya reklam",
  "Uygunsuz içerik",
  "Taciz veya hakaret",
  "Gerçek olmayan proje",
  "Diğer",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_DETAILS_MAX = 500;
export const REPORT_OK_MESSAGE = "Şikayetin alındı. Ekibimiz inceleyecek.";
