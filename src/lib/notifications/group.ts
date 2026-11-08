// Bildirim listesini zamana göre gruplar. Girdi en yeniden eskiye sıralı beklenir; her grup
// kendi sırasını korur ve boş gruplar çıktıya girmez.
// Gün sınırları İstanbul saatine göredir (Europe/Istanbul); sunucunun yerel gece yarısı kullanılmaz.

import { startOfIstanbulDay } from "@/lib/time";

export type NotificationGroupLabel = "Bugün" | "Bu hafta" | "Daha önce";

export interface NotificationGroup<T> {
  label: NotificationGroupLabel;
  items: T[];
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * "Bugün": İstanbul'da bugünün başından (00:00) itibaren. "Bu hafta": önceki altı İstanbul günü.
 * Diğerleri "Daha önce".
 */
export function notificationGroupOf(createdAt: Date, now: Date): NotificationGroupLabel {
  const startOfToday = startOfIstanbulDay(now).getTime();
  if (createdAt.getTime() >= startOfToday) return "Bugün";

  // İstanbul'da yaz saati yoktur (sabit UTC+3), bu yüzden altı gün tam olarak 6 × 24 saattir.
  const weekStart = startOfToday - 6 * DAY;
  if (createdAt.getTime() >= weekStart) return "Bu hafta";

  return "Daha önce";
}

export function groupNotifications<T extends { createdAt: Date }>(items: T[], now: Date): NotificationGroup<T>[] {
  const groups: NotificationGroup<T>[] = [];
  for (const item of items) {
    const label = notificationGroupOf(item.createdAt, now);
    const existing = groups.find((group) => group.label === label);
    if (existing) existing.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}
