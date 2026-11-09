import { House, LayoutGrid, MessageCircle, Plus, Users, type LucideIcon } from "lucide-react";
import type { Counters } from "@/lib/counters";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: (counters: Counters | null) => number;
  /** Rozetin ekran okuyucu metni (ör. "3 okunmamış"); bağlantının erişilebilir adına eklenir. */
  badgeLabel?: (count: number) => string;
  primary?: boolean;
}

/** Ana gezinmenin beş öğesi; telefonda alt menü, masaüstünde sol kenar menü aynı listeyi kullanır. */
export const NAV_ITEMS: readonly NavItem[] = [
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

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function navAccessibleName(item: NavItem, badgeCount: number): string | undefined {
  return badgeCount > 0 && item.badgeLabel ? `${item.label}, ${item.badgeLabel(badgeCount)}` : undefined;
}
