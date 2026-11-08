"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./button";
import { Spinner } from "./spinner";

export interface SubmitButtonProps extends Omit<ButtonProps, "type" | "loading"> {
  /**
   * Stili tamamen çağıran verir (ör. menü satırı): Button'ın varyant ve boyut sınıfları eklenmez,
   * bekleme sırasında içeriğin sonuna bir döner simge eklenir.
   */
  unstyled?: boolean;
}

/**
 * Form gönderme düğmesi. Sunucu eylemi sürerken (`useFormStatus().pending`) döner simge gösterir ve
 * devre dışı kalır; yavaş bağlantıda ikinci dokunuş yeni bir gönderim başlatmaz. Bir `<form>` içinde kullanılır.
 */
export function SubmitButton({ unstyled = false, disabled, children, className, variant, size, ...rest }: SubmitButtonProps) {
  const { pending } = useFormStatus();

  if (unstyled) {
    return (
      <button
        type="submit"
        disabled={disabled || pending}
        aria-busy={pending || undefined}
        className={className}
        {...rest}
      >
        {children}
        {pending ? <Spinner className="ml-auto size-4" /> : null}
      </button>
    );
  }

  return (
    <Button type="submit" variant={variant} size={size} loading={pending} disabled={disabled} className={className} {...rest}>
      {children}
    </Button>
  );
}
