import type { ZodError } from "zod";

/** Server Action sonucu. Formlar `useActionState` ile okur. */
export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T = void>(data?: T): ActionResult<T> {
  return data === undefined ? { ok: true } : { ok: true, data };
}

export function fail(
  error: string,
  fieldErrors?: Record<string, string>,
): ActionResult<never> {
  return fieldErrors === undefined
    ? { ok: false, error }
    : { ok: false, error, fieldErrors };
}

/** Zod hatasından alan başına ilk mesajı çıkarır. Kök hatalar "_form" anahtarına yazılır. */
export function zodFieldErrors(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_form";
    if (out[key] === undefined) {
      out[key] = issue.message;
    }
  }
  return out;
}
