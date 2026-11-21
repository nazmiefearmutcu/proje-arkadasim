import Image from "next/image";
import pandaLargeDark from "@/assets/brand/panda-large-dark.png";
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

/** Büyük, kürk dokulu panda (koyu zemin). */
export function PandaHero({ className }: { className?: string }) {
  return <Image src={pandaLargeDark} alt="" className={cn("h-auto w-full", className)} sizes="(min-width: 640px) 256px, 192px" />;
}

/** Marka: panda işareti ve ad. Yazının rengini çağıran taraf verir. */
export function Logo({ className, onLight = false }: { className?: string; onLight?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark onLight={onLight} />
      <span className="font-display text-[16px] leading-none font-[700] tracking-tight whitespace-nowrap">Proje Arkadaşım</span>
    </span>
  );
}
