import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { controlBase } from "./styles";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Çok satır giriş. Yükseklik içeriğe göre büyür (CSS field-sizing), en az 3 satır. */
export function Textarea({ className, rows = 3, ...rest }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(controlBase, "field-sizing-content min-h-[88px] px-3.5 py-3", className)}
      {...rest}
    />
  );
}
