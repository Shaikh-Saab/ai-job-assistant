"use client";

import { CalendarClock } from "lucide-react";
import { ChartPanel } from "@/components/dashboard/charts";
import { PriorityBadge, StatusBadge } from "@/components/projects/project-badges";
import { DotMeter } from "@/components/ui/dot-meter";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardStats } from "@/lib/data/projects";
import { cn, formatDate } from "@/lib/utils";
import { useUIStore } from "@/store/ui-store";

const DAY = 86_400_000;

function relative(due: string) {
  const days = Math.round((new Date(due).getTime() - Date.now()) / DAY);
  if (days < 0) return { text: `${-days}d overdue`, late: true };
  if (days === 0) return { text: "Due today", late: false };
  return { text: `in ${days}d`, late: false };
}

export function Deadlines({ items, className }: { items?: DashboardStats["deadlines"]; className?: string }) {
  const openEdit = useUIStore((s) => s.openEditProject);

  return (
    <ChartPanel eyebrow="Schedule" title="Upcoming deadlines" description="Open projects with the nearest due dates" className={className}>
      {!items ? (
        <Skeleton className="h-60 w-full" />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted-foreground">
          <CalendarClock className="h-8 w-8" aria-hidden="true" />
          No open projects have a due date.
        </div>
      ) : (
        <ol className="divide-y divide-dashed">
          {items.map((p) => {
            const rel = p.dueDate ? relative(p.dueDate) : null;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
                <div className="w-20 shrink-0">
                  <p
                    suppressHydrationWarning
                    className={cn("font-mono text-xs font-semibold", rel?.late ? "text-red-700 dark:text-red-400" : "text-foreground")}
                  >
                    {rel?.text}
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground" suppressHydrationWarning>
                    {formatDate(p.dueDate)}
                  </p>
                </div>
                <button
                  type="button"
                  className="min-w-0 flex-1 truncate text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => openEdit(p)}
                >
                  {p.name}
                </button>
                <div className="flex items-center gap-3">
                  <StatusBadge status={p.status} />
                  <PriorityBadge priority={p.priority} />
                  <DotMeter value={p.progress} className="hidden md:flex" />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </ChartPanel>
  );
}
