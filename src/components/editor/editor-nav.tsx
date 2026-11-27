"use client";

import { FileCheck2, Flag, LayoutGrid, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { focusRing } from "@/components/ui/styles";
import { cn } from "@/lib/cn";

export interface EditorCounts {
  content: number;
  documents: number;
  reports: number;
}

const ITEMS = [
  { href: "/editor", label: "Genel bakış", icon: LayoutGrid, count: null },
  { href: "/editor/icerik", label: "İçerik denetimi", icon: ShieldAlert, count: "content" },
  { href: "/editor/belgeler", label: "Belgeler", icon: FileCheck2, count: "documents" },
  { href: "/editor/sikayetler", label: "Şikayetler", icon: Flag, count: "reports" },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === "/editor" ? pathname === "/editor" : pathname.startsWith(href);
}

/**
 * Editör menüsü. Masaüstünde solda dikey liste, telefonda üst barın altında yatay kaydırılan sekmeler.
 * Sayılar bekleyen iş adedidir; sıfırsa gösterilmez.
 */
export function EditorNav({ counts, variant }: { counts: EditorCounts; variant: "side" | "tabs" }) {
  const pathname = usePathname();

  if (variant === "tabs") {
    return (
      <nav aria-label="Editör menüsü" className="border-b border-line bg-surface lg:hidden">
        <ul className="flex gap-1 overflow-x-auto px-3">
          {ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const count = item.count ? counts[item.count] : 0;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex min-h-12 items-center gap-1.5 px-2 whitespace-nowrap t-label",
                    active ? "text-ink" : "text-ink-3 hover:text-ink-2",
                    focusRing,
                  )}
                >
                  {item.label}
                  {count > 0 ? <CountPill value={count} /> : null}
                  <span
                    aria-hidden="true"
                    className={cn("absolute inset-x-2 bottom-0 h-0.5", active ? "bg-pen" : "bg-transparent")}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav aria-label="Editör menüsü" className="flex flex-col gap-1 p-3">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const count = item.count ? counts[item.count] : 0;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-control px-3 t-label",
              active ? "bg-pen-soft text-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              focusRing,
            )}
          >
            <Icon aria-hidden="true" strokeWidth={1.75} className="size-5 shrink-0" />
            <span className="flex-1">{item.label}</span>
            {count > 0 ? <CountPill value={count} /> : null}
          </Link>
        );
      })}
    </nav>
  );
}

function CountPill({ value }: { value: number }) {
  return (
    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-pen px-1.5 py-0.5 font-mono text-[11px] leading-none font-[600] text-pen-ink tabular-nums">
      {value > 99 ? "99+" : value}
      <span className="sr-only"> bekleyen</span>
    </span>
  );
}
