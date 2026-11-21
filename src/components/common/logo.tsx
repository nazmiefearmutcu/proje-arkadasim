import { cn } from "@/lib/cn";

const INK = "#0D1117";

/**
 * Oturan panda silüeti: düz, iki renkli çizim. Beyaz kare zemin, siyah kollar, bacaklar, kulaklar ve göz
 * lekeleri ile beyaz karın ve yüz. Zemin sayesinde siyah üst barda da beyaz sayfada da aynı okunur.
 * Kullanıldığı yerde dekoratiftir; markanın adı yanındaki yazıdadır.
 */
export function PandaMark({ className, framed = false }: { className?: string; framed?: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 64" fill="none" className={className}>
      <rect
        x="1"
        y="1"
        width="62"
        height="62"
        rx="8"
        fill="#FFFFFF"
        stroke={framed ? INK : "none"}
        strokeWidth={framed ? 2 : 0}
      />
      {/* Arka bacaklar (oturuş): öne uzanan iki yuvarlak */}
      <ellipse cx="20.5" cy="53.5" rx="9" ry="6" fill={INK} />
      <ellipse cx="43.5" cy="53.5" rx="9" ry="6" fill={INK} />
      {/* Gövde ve beyaz karın */}
      <path
        d="M32 27c-10.5 0-17 8.4-17 17.8C15 52.3 22.6 57 32 57s17-4.7 17-12.2C49 35.4 42.5 27 32 27Z"
        fill="#FFFFFF"
        stroke={INK}
        strokeWidth="2.2"
      />
      {/* Omuz bandı ve kollar */}
      <path
        d="M16.2 37.5c3.6-5.2 9.4-7.6 15.8-7.6s12.2 2.4 15.8 7.6l-1.6 9.8c-.6 3.4-5 3.7-5.9.4L38.6 40c-2-1.1-4.2-1.6-6.6-1.6s-4.6.5-6.6 1.6l-1.7 7.7c-.9 3.3-5.3 3-5.9-.4l-1.6-9.8Z"
        fill={INK}
      />
      {/* Ön pençeler bacakların üstünde */}
      <ellipse cx="22.2" cy="49.6" rx="3.9" ry="3.2" fill={INK} />
      <ellipse cx="41.8" cy="49.6" rx="3.9" ry="3.2" fill={INK} />
      {/* Kulaklar */}
      <circle cx="20" cy="9.8" r="5.6" fill={INK} />
      <circle cx="44" cy="9.8" r="5.6" fill={INK} />
      {/* Baş */}
      <ellipse cx="32" cy="19.5" rx="14.2" ry="12" fill="#FFFFFF" stroke={INK} strokeWidth="2.2" />
      {/* Göz lekeleri ve gözler */}
      <ellipse cx="26" cy="19.2" rx="3.6" ry="4.9" transform="rotate(-24 26 19.2)" fill={INK} />
      <ellipse cx="38" cy="19.2" rx="3.6" ry="4.9" transform="rotate(24 38 19.2)" fill={INK} />
      <circle cx="26.7" cy="18.3" r="1.25" fill="#FFFFFF" />
      <circle cx="37.3" cy="18.3" r="1.25" fill="#FFFFFF" />
      {/* Burun ve ağız */}
      <ellipse cx="32" cy="25" rx="2.5" ry="1.7" fill={INK} />
      <path d="M29.7 27.6c1.3 1.1 3.3 1.1 4.6 0" stroke={INK} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Üst barda ve sayfalarda kullanılan marka işareti. `onLight` açık zeminde ince çerçeve ekler. */
export function LogoMark({ className, onLight = false }: { className?: string; onLight?: boolean }) {
  return <PandaMark framed={onLight} className={cn("size-9 shrink-0", className)} />;
}

/** Marka: panda işareti ve "Proje Arkadaşım" yazısı. Yazının rengini çağıran taraf verir. */
export function Logo({ className, onLight = false }: { className?: string; onLight?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark onLight={onLight} />
      <span className="font-display text-[16px] leading-none font-[700] tracking-tight whitespace-nowrap">Proje Arkadaşım</span>
    </span>
  );
}
