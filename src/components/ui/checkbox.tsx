import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, ReactNode } from "react";
import { focusRing } from "./styles";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: ReactNode;
  description?: string;
}

/** Onay kutusu. Tüm satır tıklanabilir ve en az 44 px yüksekliktedir. */
export function Checkbox({ label, description, className, ...rest }: CheckboxProps) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-start gap-3 py-2", className)}>
      <input type="checkbox" className={cn("mt-0.5 size-5 shrink-0 accent-pen", focusRing)} {...rest} />
      <span className="flex flex-col gap-0.5">
        <span className="t-body text-ink">{label}</span>
        {description ? <span className="t-meta text-ink-3">{description}</span> : null}
      </span>
    </label>
  );
}
