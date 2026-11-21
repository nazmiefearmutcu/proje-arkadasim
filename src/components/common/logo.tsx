import { cn } from "@/lib/cn";

const INK = "#0D1117";

/**
 * Marka işareti: geometrik, düz bir panda yüzü. Beyaz kare zemin ve ince siyah çerçeve sayesinde hem siyah
 * üst barda hem beyaz sayfada aynı görünür; arayüzün siyah-beyaz diliyle bire bir uyuşur.
 * `onLight` geriye dönük uyumluluk için kabul edilir; işaret her zeminde aynıdır.
 */
export function LogoMark({ className }: { className?: string; onLight?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className={cn("size-8 shrink-0", className)}>
      <rect x="0.75" y="0.75" width="30.5" height="30.5" rx="3" fill="#FFFFFF" stroke={INK} strokeWidth="1.5" />
      {/* Kulaklar */}
      <circle cx="9.2" cy="9.6" r="4.1" fill={INK} />
      <circle cx="22.8" cy="9.6" r="4.1" fill={INK} />
      {/* Baş */}
      <ellipse cx="16" cy="18" rx="10.2" ry="9.1" fill="#FFFFFF" stroke={INK} strokeWidth="1.6" />
      {/* Göz lekeleri */}
      <ellipse cx="11.7" cy="17.3" rx="2.6" ry="3.5" transform="rotate(-28 11.7 17.3)" fill={INK} />
      <ellipse cx="20.3" cy="17.3" rx="2.6" ry="3.5" transform="rotate(28 20.3 17.3)" fill={INK} />
      {/* Gözler */}
      <circle cx="12.3" cy="16.6" r="0.95" fill="#FFFFFF" />
      <circle cx="19.7" cy="16.6" r="0.95" fill="#FFFFFF" />
      {/* Burun ve ağız */}
      <ellipse cx="16" cy="21.4" rx="1.8" ry="1.25" fill={INK} />
      <path d="M14.3 23.3c.9.9 2.5.9 3.4 0" stroke={INK} strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}

/** Marka: panda işareti ve "Proje Arkadaşım" yazısı. Yazının rengini çağıran taraf verir. */
export function Logo({ className }: { className?: string; onLight?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-display text-[16px] leading-none font-[700] tracking-tight whitespace-nowrap">Proje Arkadaşım</span>
    </span>
  );
}
