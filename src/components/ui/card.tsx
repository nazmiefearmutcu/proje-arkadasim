import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

/** Yüzey kartı: 16 px köşe, ince kenar, gölge yok. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("relative rounded-card border border-line bg-surface", className)} {...rest} />;
}
