"use client";

import { House, LayoutGrid, MessageCircle, Plus, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/cn";
import type { Counters } from "@/lib/counters";
import { useCounters } from "./use-counters";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: (counters: Counters | null) => number;
  /** Rozetin ekran okuyucu metni (ör. "3 okunmamış"); bağlantının erişilebilir adına eklenir. */
  badgeLabel?: (count: number) => string;
  primary?: boolean;
}

const ITEMS: readonly NavItem[] = [
  { href: "/", label: "Ana Sayfa", icon: House },
  {
    href: "/network",
    label: "Network",
    icon: Users,
    badge: (c) => c?.invites ?? 0,
    badgeLabel: (count) => `${count} bekleyen davet`,
  },
  { href: "/paylas", label: "Paylaş", icon: Plus, primary: true },
  {
    href: "/mesajlar",
    label: "Mesajlarım",
    icon: MessageCircle,
    badge: (c) => (c ? c.messages + c.requests : 0),
    badgeLabel: (count) => `${count} okunmamış`,
  },
  { href: "/projeler", label: "Projeler", icon: LayoutGrid },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Alt menü (64 px + güvenli alan). Paylaş ortada, tükenmez mavisi bir daire olarak yükselir.
 * Network ve Mesajlarım'da bekleyen öğe rozetleri gösterilir. Rozet sayısı bağlantının erişilebilir adına
 * bağlamıyla eklenir ("Mesajlarım, 3 okunmamış"), bildirim zilindeki gibi; çıplak sayı okunmaz.
 */
export function BottomNav({ initial }: { initial: Counters | null }) {
  const pathname = usePathname();
  const counters = useCounters(initial);

  return (
    <nav
      aria-label="Ana gezinme"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto grid h-16 max-w-[640px] grid-cols-5">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          const badgeCount = item.badge ? item.badge(counters) : 0;
          const accessibleName =
            badgeCount > 0 && item.badgeLabel ? `${item.label}, ${item.badgeLabel(badgeCount)}` : undefined;

          return (
            <li key={item.href} className="flex">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={accessibleName}
                className={cn(
                  "flex min-h-11 w-full flex-col items-center justify-end gap-1 pb-2 text-[11px] leading-[1.2]",
                  active ? "font-[650] text-ink" : "font-[450] text-ink-3",
                  focusRing,
                )}
              >
                {item.primary ? (
                  <span className="flex size-[52px] items-center justify-center rounded-full bg-pen text-pen-ink shadow-fab">
                    <Icon aria-hidden="true" strokeWidth={1.75} className="size-6" />
                  </span>
                ) : (
                  <span className="relative inline-flex size-6 items-center justify-center">
                    <Icon aria-hidden="true" strokeWidth={1.75} className="size-5" />
                    {badgeCount > 0 ? (
                      <Badge count={badgeCount} className="absolute -top-1.5 -right-2.5" />
                    ) : null}
                  </span>
                )}
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
