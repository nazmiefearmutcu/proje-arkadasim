// Editörün ilan kaldırma nedenleri. Sahibine giden bildirimde bu etiketler görünür.
export const REMOVAL_REASONS = {
  SPAM: "Spam",
  ADVERTISING: "Reklam",
  RULES: "Kurallara aykırı",
  INAPPROPRIATE: "Uygunsuz içerik",
} as const;

export type RemovalReason = keyof typeof REMOVAL_REASONS;
