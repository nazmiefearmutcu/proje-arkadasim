import Image from "next/image";
import pandaLargeDark from "@/assets/brand/panda-large-dark.png";
import pandaLargeLight from "@/assets/brand/panda-large-light.png";
import pandaMark from "@/assets/brand/panda-mark.png";
import pandaMarkDark from "@/assets/brand/panda-mark-dark.png";
import { cn } from "@/lib/cn";

// Marka: oturan panda (logo paketi "Panda Silüet Logo"). Paketin kuralına göre küçük boyutlarda kürk
// dokusu kapalı, kenarlar keskin sürüm; büyük gösterimde kürk dokulu sürüm kullanılır. Görseller
// dekoratiftir; markanın adı yanındaki yazıdadır.

/** Küçük işaret. `onLight` açık zeminde siyah çizgili sürümü, aksi halde koyu zemin için beyaz haleli sürümü seçer. */
export function LogoMark({ className, onLight = false }: { className?: string; onLight?: boolean }) {
  return (
    <Image
      src={onLight ? pandaMark : pandaMarkDark}
      alt=""
      priority
      className={cn("h-9 w-auto shrink-0", className)}
      sizes="40px"
    />
  );
}

/** Büyük panda. `onLight` beyaz zemin için siyah sürümü, aksi halde koyu zemin için kürk dokulu negatifi seçer. */
export function PandaHero({ className, onLight = false }: { className?: string; onLight?: boolean }) {
  return (
    <Image
      src={onLight ? pandaLargeLight : pandaLargeDark}
      alt=""
      className={cn("h-auto w-full", className)}
      sizes="(min-width: 640px) 256px, 192px"
    />
  );
}

/** Marka: panda işareti ve PROBUDDY yazısı (logo paketindeki gibi büyük harf, geniş aralık). Yazının rengini çağıran taraf verir. */
export function Logo({ className, onLight = false }: { className?: string; onLight?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark onLight={onLight} />
      <span className="font-display text-[16px] leading-none font-[800] tracking-[0.14em] whitespace-nowrap">PROBUDDY</span>
    </span>
  );
}
