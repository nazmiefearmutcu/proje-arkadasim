import { Check } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { getDisciplineGroup, isDisciplineGroupId } from "@/config/taxonomy";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/cn";

/** Disiplin grubunun etiketi; tanınmayan değer olduğu gibi döner. */
export function disciplineLabel(id: string): string {
  return getDisciplineGroup(id)?.label ?? id;
}

export interface RoleStripProps {
  title: string;
  disciplineGroup: string;
  /** Aranan kişi sayısı dolmuş beceri: gri "Bulundu" kutusu olarak görünür. */
  full: boolean;
  /** Şeridin açıklaması (proje sayfası). */
  description?: string | null;
  /** Açık becerinin "Başvur" bağlantısı. Verilmezse düğme yerine `footer` gösterilir. */
  href?: string;
  /** Açık ya da dolu şeridin alt satırı (ör. kontenjan, "Ekibe katıldı"). */
  footer?: ReactNode;
  className?: string;
}

/**
 * Beceri şeridi: projenin aradığı bir beceri (rol = beceri, unvan ya da bölüm değil). Rengi becerinin
 * alanını gösterir ama bilgi beceri adındadır; renk tek başına anlam taşımaz. Şerit üzerindeki yazı her
 * alan renginde koyu mürekkeptir (en az 4.5:1). Karşılığı bulunan beceri gri bir "Bulundu" kutusudur.
 */
export function RoleStrip({ title, disciplineGroup, full, description, href, footer, className }: RoleStripProps) {
  if (full) {
    return (
      <div
        className={cn(
          "flex min-h-[116px] min-w-0 flex-col justify-between rounded-chip border border-line bg-torn p-3.5",
          className,
        )}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="t-mono tracking-wider text-ink-3 uppercase">Bulundu</span>
            <Check aria-hidden="true" strokeWidth={2} className="size-3.5 text-ink-3" />
          </div>
          <h4 className="font-display text-[14px] leading-snug font-[700] text-ink-2 [overflow-wrap:anywhere]">{title}</h4>
          <p className="text-[12px] leading-relaxed text-ink-2">Bu beceri için ekip tamamlandı.</p>
        </div>
        <div className="t-mono mt-3 border-t border-perf pt-2 text-ink-3">{footer ?? "Ekip tamamlandı"}</div>
      </div>
    );
  }

  const known = isDisciplineGroupId(disciplineGroup);
  return (
    <div
      className={cn(
        "flex min-h-[116px] min-w-0 flex-col justify-between rounded-chip border border-ink/15 p-3.5 text-ink",
        !known && "bg-surface-2",
        className,
      )}
      style={known ? { background: `var(--d-${disciplineGroup})` } : undefined}
    >
      <div className="flex flex-col gap-1">
        <h4 className="font-display text-[15px] leading-snug font-[700] [overflow-wrap:anywhere]">{title}</h4>
        {description ? (
          <p className="text-[12px] leading-relaxed text-ink/80 [overflow-wrap:anywhere]">{description}</p>
        ) : null}
      </div>
      {href ? (
        <Link
          href={href}
          className={cn(
            "mt-3 flex min-h-9 items-center justify-center rounded-chip bg-ink px-2.5 text-[12px] font-[650] text-pen-ink hover:bg-pen-strong",
            focusRing,
          )}
        >
          Başvur
        </Link>
      ) : footer ? (
        <div className="mt-3 text-[12px] font-[600]">{footer}</div>
      ) : null}
    </div>
  );
}
