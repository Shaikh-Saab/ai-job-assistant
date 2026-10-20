import { cn } from "@/lib/utils";

// 5×5 dot-matrix "N": both outer columns plus the falling diagonal.
const CELLS = Array.from({ length: 25 }, (_, i) => {
  const r = Math.floor(i / 5), c = i % 5;
  return { r, c, on: c === 0 || c === 4 || r === c };
});

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 25 25" className={cn("h-6 w-6", className)} aria-hidden="true">
      {CELLS.map(({ r, c, on }) => (
        <circle
          key={`${r}-${c}`}
          cx={c * 5 + 2.5}
          cy={r * 5 + 2.5}
          r={on ? 2 : 1}
          className={on ? "fill-primary" : "fill-dot"}
        />
      ))}
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark />
      <span className="font-dot text-xl font-black leading-none tracking-wide">NEXUS</span>
    </span>
  );
}
