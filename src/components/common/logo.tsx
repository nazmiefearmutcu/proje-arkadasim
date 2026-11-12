import { cn } from "@/lib/cn";

/**
 * Marka işareti: spiralli lacivert görev defteri ve üzerinden taşan büyük açık yeşil tik.
 * Spiral ve kenar çizgisi `currentColor` alır: mavi üst barda beyaz, açık zeminde lacivert görünür.
 * `onLight` açık zeminde tikin defter dışına taşan ucunu okunur kılmak için bir ton koyu yeşil seçer.
 */
export function LogoMark({ className, onLight = false }: { className?: string; onLight?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" fill="none" className={cn("size-[34px] shrink-0", className)}>
      <rect x="5" y="5" width="21" height="24" rx="3" fill="#0F1A3A" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 2.5v5M15.5 2.5v5M20.5 2.5v5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M9.5 23h6M9.5 26h9" stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M9 14.5l5 5L28.5 5"
        stroke={onLight ? "#3DDC84" : "#7CF0A2"}
        strokeWidth="4.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Marka: işaret ve "Proje Arkadaşım" yazısı. Rengi çağıran taraf verir; bağlantı gerekiyorsa çağıran sarar. */
export function Logo({ className, onLight = false }: { className?: string; onLight?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark onLight={onLight} />
      <span className="text-[21px] leading-none font-[800] [font-stretch:75%] tracking-[0.01em]">Proje Arkadaşım</span>
    </span>
  );
}
