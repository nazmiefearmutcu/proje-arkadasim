import Link from "next/link";
import { cn } from "@/lib/cn";
import { focusRing } from "./styles";

export interface TabItem {
  value: string;
  label: string;
  count?: number;
}

/**
 * Bağlantı sekmeleri. Her sekme `basePath?sekme=<değer>` adresine gider; sekme sunucuda okunur
 * ve geri tuşu çalışır. Aktif sekmenin altında 2 px tükenmez mavisi çizgi olur.
 */
export function Tabs({
  items,
  active,
  basePath,
  param = "sekme",
  label,
}: {
  items: TabItem[];
  active: string;
  basePath: string;
  param?: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="border-b border-line">
      <ul className="flex gap-5 overflow-x-auto">
        {items.map((item) => {
          const isActive = item.value === active;
          return (
            <li key={item.value}>
              <Link
                href={`${basePath}?${param}=${encodeURIComponent(item.value)}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 items-center gap-2 whitespace-nowrap t-label",
                  isActive ? "text-ink" : "text-ink-3 hover:text-ink-2",
                  focusRing,
                )}
              >
                {item.label}
                {item.count ? <span className="t-meta text-ink-3">{item.count}</span> : null}
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-0.5 rounded-full",
                    isActive ? "bg-pen" : "bg-transparent",
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
