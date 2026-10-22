"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  labelAction?: React.ReactNode;
  /** "lg" = bigger label, hint and error text (used on the sign-in screens). */
  size?: "default" | "lg";
  /** Receives the aria props to spread onto the control so errors are announced. */
  children: (aria: {
    id: string;
    "aria-invalid": boolean;
    "aria-describedby"?: string;
  }) => React.ReactNode;
};

/** Label + control + hint/error, wired with aria-describedby / aria-invalid. */
export function FormField({ id, label, error, hint, className, labelAction, size = "default", children }: FormFieldProps) {
  const lg = size === "lg";
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id} className={cn(lg && "text-lg font-semibold")}>
          {label}
        </Label>
        {labelAction}
      </div>
      {children({ id, "aria-invalid": !!error, "aria-describedby": describedBy })}
      {hint && !error && (
        <p id={hintId} className={cn("text-muted-foreground", lg ? "text-base" : "text-xs")}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className={cn("font-medium text-destructive", lg ? "text-base" : "text-xs")}>
          {error}
        </p>
      )}
    </div>
  );
}
