import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { controlBase } from "./styles";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;

/** Tek satır giriş. `Field` içinde kullanılırsa id ve aria bağlantıları otomatik gelir. */
export function Input({ className, type = "text", ...rest }: InputProps) {
  return <input type={type} className={cn(controlBase, "h-11 px-3.5", className)} {...rest} />;
}
