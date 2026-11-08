import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

export interface FieldProps {
  /** Denetimin id'si. Etiket, ipucu ve hata bu kimlikten türetilir. */
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

type ControlProps = Record<string, unknown> & { id?: string; "aria-describedby"?: string };

/**
 * Etiket + denetim + ipucu + hata. Tek çocuk olarak bir denetim (Input, Textarea, Select) alır;
 * ona id, aria-describedby ve aria-invalid ekler. Çocukta zaten verilmiş değerlere dokunmaz.
 */
export function Field({ id, label, hint, error, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  const child = Children.only(children);
  const control = isValidElement(child)
    ? cloneElement(child as ReactElement<ControlProps>, {
        id: (child.props as ControlProps).id ?? id,
        "aria-describedby": (child.props as ControlProps)["aria-describedby"] ?? describedBy,
        "aria-invalid": error ? true : undefined,
      })
    : child;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="t-label text-ink">
        {label}
      </label>
      {control}
      {hint ? (
        <p id={hintId} className="t-meta text-ink-3">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="t-meta text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
