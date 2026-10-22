"use client";

import * as React from "react";
import { Eye, EyeOff, TriangleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Password box with a labelled Show/Hide button and a Caps Lock warning –
 * the two things that cause most "wrong password" mistakes.
 */
export const PasswordInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, onKeyDown, onKeyUp, onBlur, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    const [capsLock, setCapsLock] = React.useState(false);
    const checkCaps = (e: React.KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState?.("CapsLock") ?? false);
    const capsId = props.id ? `${props.id}-caps` : undefined;

    return (
      <div className="space-y-2">
        <div className="relative">
          <Input
            ref={ref}
            type={visible ? "text" : "password"}
            className={cn("pr-28", className)}
            onKeyDown={(e) => {
              checkCaps(e);
              onKeyDown?.(e);
            }}
            onKeyUp={(e) => {
              checkCaps(e);
              onKeyUp?.(e);
            }}
            onBlur={(e) => {
              setCapsLock(false);
              onBlur?.(e);
            }}
            {...props}
            aria-describedby={[props["aria-describedby"], capsLock ? capsId : undefined].filter(Boolean).join(" ") || undefined}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute inset-y-1.5 right-1.5 flex items-center gap-2 rounded-md border bg-background px-3 text-base font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
          >
            {visible ? <EyeOff className="h-5 w-5" aria-hidden="true" /> : <Eye className="h-5 w-5" aria-hidden="true" />}
            <span aria-hidden="true">{visible ? "Hide" : "Show"}</span>
          </button>
        </div>
        {capsLock && (
          <p id={capsId} role="status" className="flex items-center gap-2 text-base font-medium text-amber-800 dark:text-amber-300">
            <TriangleAlert className="h-5 w-5" aria-hidden="true" /> Caps Lock is on
          </p>
        )}
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";
