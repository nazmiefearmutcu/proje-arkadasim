import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, ReactNode } from "react";
import { focusRing } from "./styles";

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  description?: string;
}

/** Anahtar (açık/kapalı). Yerel onay kutusunun `role="switch"` biçimi. */
export function Switch({ label, description, className, ...rest }: SwitchProps) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-center justify-between gap-4 py-2", className)}>
      <span className="flex flex-col gap-0.5">
        <span className="t-body text-ink">{label}</span>
        {description ? <span className="t-meta text-ink-3">{description}</span> : null}
      </span>
      <input
        type="checkbox"
        role="switch"
        className={cn(
          "relative h-6 w-11 shrink-0 appearance-none rounded-chip border border-line bg-surface-2 transition-colors before:absolute before:top-0.5 before:left-0.5 before:size-5 before:rounded-full before:bg-surface before:transition-transform checked:border-pen checked:bg-pen checked:before:translate-x-5 disabled:opacity-50",
          focusRing,
        )}
        {...rest}
      />
    </label>
  );
}
