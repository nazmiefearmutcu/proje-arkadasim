// Ortak görsel sınıflar. Odak halkası her etkileşimli öğede aynıdır (tükenmez mavisi).
export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pen";

// Metin girişleri: 44 px yükseklik, 12 px köşe, yüzey zemini, ince kenar, 16 px metin (iOS yakınlaştırmasını önler).
export const controlBase =
  "w-full rounded-control border border-line bg-surface text-[16px] leading-[1.4] text-ink placeholder:text-ink-3 disabled:opacity-60 aria-[invalid=true]:border-danger " +
  focusRing;
