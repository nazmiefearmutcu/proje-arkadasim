import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { controlBase } from "./styles";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** Yerel `select`, uygulama stiliyle. Açılır liste işletim sisteminin kendisidir (mobilde en iyi erişilebilirlik). */
export function Select({ className, children, ...rest }: SelectProps) {
  return (
    <div className="relative">
      <select className={cn(controlBase, "h-11 appearance-none pr-10 pl-3.5", className)} {...rest}>
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        strokeWidth={1.75}
        className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-ink-3"
      />
    </div>
  );
}
