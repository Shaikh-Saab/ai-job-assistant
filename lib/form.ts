import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import type { ActionResult } from "@/types/actions";

/** Copies server-side Zod field errors onto a react-hook-form instance. */
export function applyFieldErrors<T extends FieldValues>(
  result: Extract<ActionResult<unknown>, { ok: false }>,
  setError: UseFormSetError<T>,
) {
  for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
    if (messages?.[0]) setError(field as Path<T>, { type: "server", message: messages[0] });
  }
}
