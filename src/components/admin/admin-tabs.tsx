"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/components/ui/styles";

const ITEMS = [
  { href: "/admin", label: "Genel bakış" },
  { href: "/admin/dogrulamalar", label: "Doğrulamalar" },
  { href: "/admin/sikayetler", label: "Şikayetler" },
] as const;

/**
 * Yönetim sekmeleri. Her sekme ayrı bir sayfadır; aktif sekme yoldan bulunur. Görünüm `Tabs`
 * bileşeniyle aynıdır (2 px tükenmez mavisi çizgi), yalnızca bağlantılar yol tabanlıdır.
 */
export function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Yönetim sekmeleri" className="border-b border-line">
      <ul className="flex gap-5 overflow-x-auto">
        {ITEMS.map((item) => {
          const isActive =
            item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 items-center whitespace-nowrap t-label",
                  isActive ? "text-ink" : "text-ink-3 hover:text-ink-2",
                  focusRing,
                )}
              >
                {item.label}
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
