"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import type { Counters } from "@/lib/counters";
import { NAV_ITEMS, isNavActive, navAccessibleName } from "./nav-items";
import { useCounters } from "./use-counters";

/**
 * Masaüstü (lg ve üstü) sol kenar menü: alt menünün beş öğesi, etiketli ve yapışkan.
 * Paylaş birincil düğme olarak en üstte durur; rozetler alt menüdekiyle aynı paylaşılan sayaçtan okunur.
 */
export function SideNav({ initial }: { initial: Counters | null }) {
  const pathname = usePathname();
  const counters = useCounters(initial);
  const share = NAV_ITEMS.find((item) => item.primary);
  const links = NAV_ITEMS.filter((item) => !item.primary);

  return (
    <nav aria-label="Ana gezinme" className="sticky top-[84px] hidden flex-col gap-4 self-start lg:flex">
      <ul className="flex flex-col gap-1">
        {links.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = item.icon;
          const badgeCount = item.badge ? item.badge(counters) : 0;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={navAccessibleName(item, badgeCount)}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-control px-3 t-body",
                  active ? "bg-pen-soft font-[700] text-pen" : "font-[500] text-ink hover:bg-surface",
                  focusRing,
                )}
              >
                <Icon aria-hidden="true" strokeWidth={active ? 2 : 1.75} className="size-5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {badgeCount > 0 ? <Badge count={badgeCount} /> : null}
              </Link>
            </li>
          );
        })}
      </ul>

      {share ? (
        <Link
          href={share.href}
          aria-current={isNavActive(pathname, share.href) ? "page" : undefined}
          className={cn(
            "flex min-h-12 items-center justify-center gap-2 rounded-control bg-pen px-4 text-[15px] font-[700] text-pen-ink hover:bg-pen-strong",
            focusRing,
          )}
        >
          <share.icon aria-hidden="true" strokeWidth={2} className="size-5" />
          Proje paylaş
        </Link>
      ) : null}
    </nav>
  );
}
