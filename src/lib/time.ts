const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const DATE_FORMAT = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Göreli Türkçe zaman: "az önce", "5 dakika önce", "3 saat önce", "dün", "4 gün önce",
 * "2 hafta önce"; bundan eski tarihler "d MMMM yyyy" biçiminde yazılır.
 */
export function relativeTimeTr(date: Date, now: Date = new Date()): string {
  const diff = now.getTime() - date.getTime();
  if (diff < MINUTE) return "az önce";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} dakika önce`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} saat önce`;

  const days = Math.floor(diff / DAY);
  if (days === 1) return "dün";
  if (days < 7) return `${days} gün önce`;
  if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
  return DATE_FORMAT.format(date);
}
