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
 * Alt menü (64 px + güvenli alan). Paylaş ortada dolu mavi blok; seçili öğe açık mavi blok.
 * Network ve Mesajlarım'da bekleyen öğe rozetleri gösterilir. Rozet sayısı bağlantının erişilebilir adına
 * bağlamıyla eklenir ("Mesajlarım, 3 okunmamış"), bildirim zilindeki gibi; çıplak sayı okunmaz.
 * Masaüstünde (lg) gizlenir; yerini sol kenar menü (SideNav) alır.
 */
export function BottomNav({ initial }: { initial: Counters | null }) {
  const pathname = usePathname();
  const counters = useCounters(initial);

  return (
    <nav
      aria-label="Ana gezinme"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-[640px] grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(pathname, item.href);
          const Icon = item.icon;
          const badgeCount = item.badge ? item.badge(counters) : 0;
          const accessibleName = navAccessibleName(item, badgeCount);

          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={accessibleName}
                className={cn(
                  "mx-0.5 flex h-[52px] w-full flex-col items-center justify-center gap-0.5 self-center rounded-control text-[11px] leading-[1.2]",
                  item.primary
                    ? "bg-pen font-[700] text-pen-ink"
                    : active
                      ? "bg-pen-soft font-[700] text-pen"
                      : "font-[500] text-ink-2",
                  focusRing,
                )}
              >
                <span className="relative inline-flex size-6 items-center justify-center">
                  <Icon aria-hidden="true" strokeWidth={item.primary ? 2.4 : 1.75} className="size-5" />
                  {badgeCount > 0 ? <Badge count={badgeCount} className="absolute -top-1.5 -right-2.5" /> : null}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
