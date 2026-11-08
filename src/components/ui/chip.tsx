import Link from "next/link";
import type { ReactNode } from "react";
import { chipClasses } from "./chip-classes";

export { chipClasses, type ChipStyle } from "./chip-classes";

export interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  /** Verilirse baştaki nokta bu renkle boyanır (ör. `var(--d-yazilim)`). */
  dotColor?: string;
  href?: string;
  className?: string;
}

/**
 * Etiket çipi. `href` verilirse bağlantı olur (filtre çipleri için): 44 px yüksek ve tek satır.
 * Bağlantısız çipler 32 px'tir ve uzun metinde satır kırar.
 */
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
      <Link
        href={href}
        aria-current={selected ? "true" : undefined}
        className={chipClasses(selected, className, { interactive: true, nowrap: true })}
      >
        {content}
      </Link>
    );
  }
  return <span className={chipClasses(selected, className)}>{content}</span>;
}
