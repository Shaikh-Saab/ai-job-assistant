"use client";

import { AlertTriangle, CheckCircle2, Gauge, PlayCircle } from "lucide-react";
import { DotMeter } from "@/components/ui/dot-meter";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardStats } from "@/lib/data/projects";
import { cn, formatCompactCurrency, formatCurrency } from "@/lib/utils";

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

export function StatsCards({ stats }: { stats?: DashboardStats }) {
  const t = stats?.totals;
  const open = t ? t.projects - t.completed : 0;

  const metrics = [
    {
      label: "Active",
      icon: PlayCircle,
      value: t?.active,
      meter: t ? pct(t.active, t.projects) : 0,
      note: t ? `${pct(t.active, t.projects)}% of portfolio` : "",
      tone: "primary" as const,
    },
    {
      label: "Completed",
      icon: CheckCircle2,
      value: t?.completed,
      meter: t ? pct(t.completed, t.projects) : 0,
      note: t ? `${pct(t.completed, t.projects)}% delivered` : "",
      tone: "success" as const,
    },
    {
      label: "Overdue",
      icon: AlertTriangle,
      value: t?.overdue,
      meter: t ? pct(t.overdue, open) : 0,
      note: t ? `${pct(t.overdue, open)}% of open work` : "",
      tone: "danger" as const,
      alert: (t?.overdue ?? 0) > 0,
    },
    {
      label: "Avg. progress",
      icon: Gauge,
      value: t ? `${t.avgProgress}%` : undefined,
      meter: t?.avgProgress ?? 0,
      note: "Across all projects",
      tone: "signal" as const,
    },
  ];

  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6" aria-label="Key metrics">
      {/* Portfolio hero */}
      <li className="relative overflow-hidden rounded-xl border bg-[hsl(var(--ink-panel))] p-6 text-white sm:col-span-2">
        <div className="bg-dots-fine absolute inset-0 text-white/10" aria-hidden="true" />
        <div
          className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-[radial-gradient(circle,#3b6cf0_1.4px,transparent_1.8px)] [background-size:10px_10px] opacity-70"
          aria-hidden="true"
        />
        <div className="relative flex h-full flex-col justify-between gap-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/60">Portfolio</p>
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              {t ? (
                <p className="font-dot text-6xl font-black leading-none">{t.projects}</p>
              ) : (
                <Skeleton className="h-14 w-20 bg-white/10" />
              )}
              <p className="mt-2 text-sm text-white/70">Projects tracked</p>
            </div>
            <div>
              {t ? (
                <p className="font-dot text-4xl font-black leading-none" title={formatCurrency(t.budget)}>
                  {formatCompactCurrency(t.budget)}
                </p>
              ) : (
                <Skeleton className="h-10 w-36 bg-white/10" />
              )}
              <p className="mt-2 text-sm text-white/70">Total budget</p>
            </div>
          </div>
        </div>
      </li>

      {metrics.map(({ label, icon: Icon, value, meter, note, tone, alert }) => (
        <li key={label} className="flex flex-col justify-between gap-5 rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="eyebrow">{label}</p>
            <Icon
              className={cn("h-4 w-4", alert ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}
              aria-hidden="true"
            />
          </div>
          <div className="space-y-3">
            {value === undefined ? (
              <Skeleton className="h-10 w-16" />
            ) : (
              <p className="font-dot text-5xl font-black leading-none">
                {value}
                {alert && <span className="sr-only"> (needs attention)</span>}
              </p>
            )}
            <DotMeter value={meter} tone={tone} label={`${label} share`} dots={12} />
            <p className="text-xs text-muted-foreground">{note}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
