import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

// Mirrors the password rules in lib/validations.ts.
const RULES: [string, (p: string) => boolean][] = [
  ["At least 8 characters", (p) => p.length >= 8],
  ["A capital letter (A–Z)", (p) => /[A-Z]/.test(p)],
  ["A small letter (a–z)", (p) => /[a-z]/.test(p)],
  ["A number (0–9)", (p) => /[0-9]/.test(p)],
];

/** Ticks each rule off as the person types, instead of a wall of text after they submit. */
export function PasswordChecklist({ password, id }: { password: string; id?: string }) {
  return (
    <ul id={id} className="grid gap-2 text-base sm:grid-cols-2" aria-label="Your password needs">
      {RULES.map(([label, test]) => {
        const ok = test(password);
        return (
          <li key={label} className={cn("flex items-center gap-2", ok ? "text-foreground" : "text-muted-foreground")}>
            {ok ? (
              <Check className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
            ) : (
              <Circle className="h-5 w-5 shrink-0" aria-hidden="true" />
            )}
            <span>
              {label}
              <span className="sr-only">{ok ? " — done" : " — not yet"}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
