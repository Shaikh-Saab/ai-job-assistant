/**
 * Halftone field: a grid of dots whose radius falls off with distance from a focal point,
 * like a printed screen. Pure SVG, computed at render time (no images).
 */
export function Halftone({
  cols = 28,
  rows = 34,
  gap = 14,
  focus = [0.72, 0.28],
  className,
}: {
  cols?: number;
  rows?: number;
  gap?: number;
  focus?: [number, number];
  className?: string;
}) {
  const w = cols * gap, h = rows * gap;
  const fx = focus[0] * w, fy = focus[1] * h;
  const maxD = Math.hypot(Math.max(fx, w - fx), Math.max(fy, h - fy));
  const dots: { x: number; y: number; r: number }[] = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * gap + gap / 2, y = r * gap + gap / 2;
      const t = 1 - Math.hypot(x - fx, y - fy) / maxD; // 1 at focus → 0 at far corner
      const radius = Math.max(0.6, (gap / 2.1) * Math.pow(t, 2.2));
      dots.push({ x, y, r: Number(radius.toFixed(2)) });
    }
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="currentColor" />
      ))}
    </svg>
  );
}
