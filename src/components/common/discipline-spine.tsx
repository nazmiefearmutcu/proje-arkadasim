import { isDisciplineGroupId } from "@/config/taxonomy";
import { cn } from "@/lib/cn";

export interface DisciplineSpineProps {
  /** Aranan disiplin grupları. Tanınmayan ya da boş liste tek bir `line` rengi gösterir. */
  groups: string[];
  orientation?: "vertical" | "horizontal";
  className?: string;
}

/**
 * Disiplin sırtı: projenin aradığı disiplinler renk dilimleri olarak. Dikey hâli kartın sol
 * kenarında, yatay hâli proje sayfasında bant olarak görünür. Metin etiketi taşımaz (çipler taşır),
 * bu yüzden gizlidir.
 */
export function DisciplineSpine({ groups, orientation = "vertical", className }: DisciplineSpineProps) {
  const known = groups.filter(isDisciplineGroupId);
  const segments = known.length > 0 ? known : null;
  const isVertical = orientation === "vertical";

  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex overflow-hidden rounded-chip gap-[3px]",
        isVertical ? "h-full w-[6px] flex-col" : "h-2 w-full flex-row",
        className,
      )}
    >
      {segments ? (
        segments.map((id) => (
          <span key={id} className="flex-1 rounded-chip" style={{ background: `var(--d-${id})` }} />
        ))
      ) : (
        <span className="flex-1 rounded-chip bg-line" />
      )}
    </div>
  );
}
