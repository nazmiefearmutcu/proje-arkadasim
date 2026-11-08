import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "./styles";

export function chipClasses(selected = false, className?: string): string {
  return cn(
    "inline-flex min-h-8 items-center gap-1.5 rounded-chip px-3 py-1 t-label whitespace-nowrap",
    selected ? "bg-pen-soft text-pen" : "bg-surface-2 text-ink-2",
    focusRing,
    className,
  );
}

export interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  /** Verilirse baştaki nokta bu renkle boyanır (ör. `var(--d-yazilim)`). */
  dotColor?: string;
  href?: string;
  className?: string;
}

/** Etiket çipi. `href` verilirse bağlantı olur (filtre çipleri için). */
export function Chip({ children, selected, dotColor, href, className }: ChipProps) {
  const content = (
    <>
      {dotColor ? (
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: dotColor }} />
      ) : null}
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} aria-current={selected ? "true" : undefined} className={chipClasses(selected, className)}>
        {content}
      </Link>
    );
  }
  return <span className={chipClasses(selected, className)}>{content}</span>;
}
