import { cn } from "@/lib/utils";

type DotMeterProps = {
  /** 0–100 */
  value: number;
  dots?: number;
  tone?: "primary" | "signal" | "danger" | "success";
  label?: string;
  className?: string;
};

const TONES = {
  primary: "bg-primary",
  signal: "bg-signal",
  danger: "bg-red-500 dark:bg-red-400",
  success: "bg-emerald-600 dark:bg-emerald-400",
};

/** A progress meter drawn as a row of dots; filled dots = value rounded to the dot count. */
export function DotMeter({ value, dots = 10, tone = "primary", label = "Progress", className }: DotMeterProps) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  const filled = Math.round((v / 100) * dots);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("flex items-center gap-[3px]", className)}
    >
      {Array.from({ length: dots }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn("h-[7px] w-[7px] rounded-full", i < filled ? TONES[tone] : "bg-dot")}
        />
      ))}
    </div>
  );
}
