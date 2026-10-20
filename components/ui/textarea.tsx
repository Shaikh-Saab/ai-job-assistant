import * as React from "react";
import { cn } from "@/lib/utils";
import { fieldClasses } from "@/components/ui/input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea className={cn(fieldClasses, "min-h-[80px] h-auto", className)} ref={ref} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
