import type { ReactNode } from "react";
import { getDisciplineGroup, isDisciplineGroupId } from "@/config/taxonomy";
import { cn } from "@/lib/cn";

/** Disiplin grubunun etiketi; tanınmayan değer olduğu gibi döner. */
export function disciplineLabel(id: string): string {
  return getDisciplineGroup(id)?.label ?? id;
}

export interface RoleStripProps {
  title: string;
  disciplineGroup: string;
  /** Kontenjanı dolmuş rol: şerit "koparılmış" görünür (kesik çizgili boş yuva). */
  full: boolean;
  /** `card`: ilan kartındaki küçük şerit. `page`: proje sayfasındaki büyük şerit. */
  size?: "card" | "page";
  /** Koparılmış şeridin ikinci satırı. Varsayılan "Rol doldu". */
  fullNote?: string;
  /** `page` boyutunda şeridin altına eklenen içerik (açıklama, kontenjan). */
  children?: ReactNode;
  className?: string;
}

/**
 * Koparmalı rol şeridi: ilanın altındaki her şerit aranan bir roldür ve rengi rolün disiplinidir.
 * Renk tek başına bilgi taşımaz; disiplin adı şeritte yazıyla da durur. Şerit üzerindeki yazı her
 * disiplin renginde koyu mürekkeptir (en az 4.5:1, tests/design-tokens.test.ts).
 */
export function RoleStrip({ title, disciplineGroup, full, size = "card", fullNote, children, className }: RoleStripProps) {
  const known = isDisciplineGroupId(disciplineGroup);
  const page = size === "page";

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col rounded-b-card",
        page ? "gap-2 px-5 pt-4 pb-5" : "min-h-[60px] gap-0.5 px-3 pt-2.5 pb-3",
        full ? "border-2 border-t-0 border-dashed border-torn text-ink-2" : "text-ink",
        !full && !known && "bg-surface-2",
        className,
      )}
      style={!full && known ? { background: `var(--d-${disciplineGroup})` } : undefined}
    >
      {page ? <span className="text-[13px] leading-[1.3] font-[600]">{disciplineLabel(disciplineGroup)}</span> : null}
      <span
        className={cn(
          "[overflow-wrap:anywhere]",
          page ? "t-card" : "text-[13px] leading-[1.2] font-[700]",
          full && page && "text-ink",
        )}
      >
        {title}
      </span>
      {page ? null : (
        <span className="text-[12px] leading-[1.3]">{full ? (fullNote ?? "Rol doldu") : disciplineLabel(disciplineGroup)}</span>
      )}
      {children}
    </div>
  );
}
