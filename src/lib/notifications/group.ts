// Bildirim listesini zamana göre gruplar. Girdi en yeniden eskiye sıralı beklenir; her grup
// kendi sırasını korur ve boş gruplar çıktıya girmez.

export type NotificationGroupLabel = "Bugün" | "Bu hafta" | "Daha önce";

export interface NotificationGroup<T> {
  label: NotificationGroupLabel;
  items: T[];
}

/** "Bugün": bugünün başından itibaren. "Bu hafta": son altı gün (bugün hariç). Diğerleri "Daha önce". */
export function notificationGroupOf(createdAt: Date, now: Date): NotificationGroupLabel {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  if (createdAt.getTime() >= startOfToday.getTime()) return "Bugün";

  const weekStart = new Date(startOfToday);
  weekStart.setDate(weekStart.getDate() - 6);
  if (createdAt.getTime() >= weekStart.getTime()) return "Bu hafta";

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
