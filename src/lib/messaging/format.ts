// Mesaj zamanı biçimleri. Tarayıcının yerel saatini kullanır; saf fonksiyonlardır.

const DAY_LABEL = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Gün ayırıcısı: "Bugün", "Dün" veya "d MMMM yyyy". */
export function dayLabel(date: Date, now: Date = new Date()): string {
  if (sameDay(date, now)) return "Bugün";
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (sameDay(date, yesterday)) return "Dün";
  return DAY_LABEL.format(date);
}

/** "HH:mm" (24 saat). */
export function clockLabel(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

const GROUP_GAP_MS = 5 * 60 * 1000;

/**
 * Aynı gönderenden art arda gelen ve 5 dakikadan kısa aralıklı mesajlar tek grup oluşturur.
 * Dönen dizi her mesaj için, mesajın grubun son mesajı olup olmadığını söyler (saat yalnız orada gösterilir).
 */
export function isGroupEnd(
  current: { mine: boolean; createdAt: Date; dayKey: string },
  next: { mine: boolean; createdAt: Date; dayKey: string } | undefined,
): boolean {
  if (!next) return true;
  if (next.mine !== current.mine) return true;
  if (next.dayKey !== current.dayKey) return true;
  return next.createdAt.getTime() - current.createdAt.getTime() > GROUP_GAP_MS;
}
