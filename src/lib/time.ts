const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Uygulamanın saat dilimi. Kullanıcılar Türkiye'dedir; sunucunun saat dilimi (ör. UTC) kullanılmaz. */
export const APP_TIME_ZONE = "Europe/Istanbul";

/**
 * Europe/Istanbul 2016'dan beri yaz saati uygulamadan sabit UTC+3'tür. Gün sınırları bu sabit
 * farkla hesaplanır; sunucunun yerel saat dilimine bağlı `setHours` kullanılmaz.
 */
const ISTANBUL_OFFSET_MS = 3 * HOUR;

/** İstanbul takvimine göre gün numarası (1970-01-01'den beri gün). Aynı gündeki anlar aynı sayıyı verir. */
export function istanbulDayNumber(date: Date): number {
  return Math.floor((date.getTime() + ISTANBUL_OFFSET_MS) / DAY);
}

/** Verilen anın İstanbul'daki gününün başlangıcı (00:00 İstanbul) olan an. */
export function startOfIstanbulDay(date: Date): Date {
  return new Date(istanbulDayNumber(date) * DAY - ISTANBUL_OFFSET_MS);
}

const DATE_FORMAT = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: APP_TIME_ZONE,
});

/**
 * Göreli Türkçe zaman: "az önce", "5 dakika önce", "3 saat önce", "dün", "4 gün önce",
 * "2 hafta önce"; bundan eski tarihler "d MMMM yyyy" biçiminde yazılır.
 * 24 saatten eski kayıtlarda gün sayısı (ve "dün") İstanbul takvim günlerine göredir: 6 Kasım
 * 23:30'daki kayıt 8 Kasım 01:30'da yalnız 26 saat öncedir ama iki takvim günü öncedir, "2 gün önce"
 * yazılır. Mutlak tarih de İstanbul saatine göre yazılır (sunucu UTC olsa bile).
 */
export function relativeTimeTr(date: Date, now: Date = new Date()): string {
  const diff = now.getTime() - date.getTime();
  if (diff < MINUTE) return "az önce";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} dakika önce`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} saat önce`;

  // 24 saat ya da daha eski: en az bir takvim günü önce.
  const days = Math.max(1, istanbulDayNumber(now) - istanbulDayNumber(date));
  if (days === 1) return "dün";
  if (days < 7) return `${days} gün önce`;
  if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
  return DATE_FORMAT.format(date);
}
