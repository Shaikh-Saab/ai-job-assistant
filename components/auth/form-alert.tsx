import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Large, plain-language message box with an icon, so errors aren't signalled by color alone. */
export function FormAlert({
  tone = "error",
  children,
  action,
}: {
  tone?: "error" | "success";
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const Icon = tone === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-lg border-2 p-4 text-base leading-relaxed",
        tone === "error"
          ? "border-destructive/40 bg-destructive/10 text-foreground"
          : "border-emerald-600/40 bg-emerald-600/10 text-foreground",
      )}
    >
      <Icon
        className={cn("mt-0.5 h-6 w-6 shrink-0", tone === "error" ? "text-destructive" : "text-emerald-700 dark:text-emerald-400")}
        aria-hidden="true"
      />
      <div className="space-y-3">
        <p>{children}</p>
        {action}
      </div>
    </div>
  );
}
