"use client";

import { Plus, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import type { Counters } from "@/lib/counters";
import { NAV_ITEMS, isNavActive, navAccessibleName } from "./nav-items";
import { useCounters } from "./use-counters";

function itemClasses(active: boolean): string {
  return cn(
    "flex min-h-11 w-full items-center justify-between gap-3 rounded-control px-3 text-[14px]",
    active ? "bg-pen-soft font-[650] text-ink" : "font-[500] text-ink-2 hover:bg-surface-2 hover:text-ink",
    focusRing,
  );
}

/**
 * Masaüstü (lg ve üstü) sol kenar menü: üst barın altında, ekranın sol kenarında sabit, tam boy beyaz
 * panel. Ana gezinme öğeleri üstte, "Proje paylaş" bir çizginin altında, Ayarlar en altta sabit.
 * Rozetler alt menüdekiyle aynı paylaşılan sayaçtan okunur.
 */
export function SideNav({ initial }: { initial: Counters | null }) {
  const pathname = usePathname();
  const counters = useCounters(initial);
  const links = NAV_ITEMS.filter((item) => !item.primary);
  const settingsActive = pathname === "/ayarlar" || pathname.startsWith("/ayarlar/");

  return (
    <aside className="fixed top-[60px] bottom-0 left-0 z-20 hidden w-[230px] flex-col border-r border-line bg-surface lg:flex">
      <nav aria-label="Ana gezinme" className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
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
                  className={itemClasses(active)}
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <Icon aria-hidden="true" strokeWidth={2} className="size-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {badgeCount > 0 ? (
                    <span className="t-mono rounded-chip bg-pen px-1.5 py-0.5 leading-none font-[600] text-pen-ink">
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-2 border-t border-line pt-4">
          <Link
            href="/paylas"
            aria-current={isNavActive(pathname, "/paylas") ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center justify-center gap-2 rounded-control bg-pen px-3 text-[14px] font-[650] text-pen-ink hover:bg-pen-strong",
              focusRing,
            )}
          >
            <Plus aria-hidden="true" strokeWidth={2.2} className="size-4" />
            Proje paylaş
          </Link>
        </div>
      </nav>

      <div className="border-t border-line p-3">
        <Link href="/ayarlar" aria-current={settingsActive ? "page" : undefined} className={itemClasses(settingsActive)}>
          <span className="flex items-center gap-3">
            <Settings aria-hidden="true" strokeWidth={2} className="size-4 shrink-0" />
            Ayarlar
          </span>
        </Link>
      </div>
    </aside>
  );
}
