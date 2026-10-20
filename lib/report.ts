import type { Project } from "@prisma/client";
import { PROJECT_STATUSES } from "@/lib/validations";

export type ReportSummary = {
  total: number;
  active: number;
  completed: number;
  overdue: number;
  open: number;
  budget: number;
  avgProgress: number;
  byStatus: { status: (typeof PROJECT_STATUSES)[number]; count: number }[];
  monthly: { month: string; created: number; completed: number }[];
};

/** Aggregates computed from exactly the rows in the report, so every figure matches the table. */
export function summarize(rows: Project[], now = new Date()): ReportSummary {
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));
  const key = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}`;

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    return { key: key(d), month: d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }), created: 0, completed: 0 };
  });
  const byKey = new Map(months.map((m) => [m.key, m]));
  for (const r of rows) {
    if (r.createdAt >= start) byKey.get(key(r.createdAt))!.created++;
    if (r.completedAt && r.completedAt >= start) {
      const m = byKey.get(key(r.completedAt));
      if (m) m.completed++;
    }
  }

  const completed = count("COMPLETED");
  return {
    total: rows.length,
    active: count("ACTIVE"),
    completed,
    open: rows.length - completed,
    overdue: rows.filter((r) => r.status !== "COMPLETED" && r.dueDate && r.dueDate < now).length,
    budget: rows.reduce((a, r) => a + r.budget, 0),
    avgProgress: rows.length ? Math.round(rows.reduce((a, r) => a + r.progress, 0) / rows.length) : 0,
    byStatus: PROJECT_STATUSES.map((status) => ({ status, count: count(status) })),
    monthly: months.map(({ month, created, completed: c }) => ({ month, created, completed: c })),
  };
}
