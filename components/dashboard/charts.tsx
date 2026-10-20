"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardStats } from "@/lib/data/projects";
import { STATUS_LABELS } from "@/lib/validations";

// Colors come from CSS variables so light/dark each use their own validated steps.
const C = {
  s1: "var(--chart-1)",
  s2: "var(--chart-2)",
  grid: "var(--chart-grid)",
  axis: "var(--chart-axis)",
};

const axisProps = {
  stroke: C.axis,
  tick: { fill: C.axis, fontSize: 11, fontFamily: "var(--font-mono)" },
  tickLine: false,
  axisLine: false,
} as const;

// Dotted gridlines: 1px dashes with round caps read as a row of dots.
const dottedGrid = { stroke: C.grid, strokeDasharray: "1 6", strokeLinecap: "round" as const, strokeWidth: 1.5 };

function ChartTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[150px] rounded-lg border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-lg">
      <p className="eyebrow mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey as string} className="flex items-center gap-2 tabular">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden="true" />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function ChartPanel({
  eyebrow,
  title,
  description,
  aside,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border bg-card ${className ?? ""}`}>
      <header className="flex flex-wrap items-start justify-between gap-4 p-6 pb-2">
        <div className="space-y-1">
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {aside}
      </header>
      <div className="p-6 pt-4">{children}</div>
    </section>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex gap-4 text-sm text-muted-foreground" aria-hidden="true">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export function ActivityChart({ data, className }: { data?: DashboardStats["monthly"]; className?: string }) {
  return (
    <ChartPanel
      eyebrow="Throughput"
      title="Activity"
      description="Projects created vs. completed, last 6 months"
      aside={<Legend items={[{ label: "Created", color: C.s1 }, { label: "Completed", color: C.s2 }]} />}
      className={className}
    >
      {!data ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <>
          <div className="h-72" role="img" aria-label="Line chart of projects created and completed per month. Data table follows.">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid {...dottedGrid} vertical={false} />
                <XAxis dataKey="month" {...axisProps} dy={8} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: C.axis, strokeDasharray: "2 4" }} />
                <Line type="monotone" name="Created" dataKey="created" stroke={C.s1} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))", fill: C.s1 }} activeDot={{ r: 6 }} />
                <Line type="monotone" name="Completed" dataKey="completed" stroke={C.s2} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))", fill: C.s2 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>Projects created and completed per month</caption>
            <thead>
              <tr><th scope="col">Month</th><th scope="col">Created</th><th scope="col">Completed</th></tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.month}><th scope="row">{d.month}</th><td>{d.created}</td><td>{d.completed}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </ChartPanel>
  );
}

export function StatusChart({ data, className }: { data?: DashboardStats["byStatus"]; className?: string }) {
  const rows = data?.map((d) => ({ label: STATUS_LABELS[d.status], count: d.count }));

  return (
    <ChartPanel eyebrow="Pipeline" title="By status" description="Where your projects stand today" className={className}>
      {!rows ? (
        <Skeleton className="h-72 w-full" />
      ) : (
        <>
          <div className="h-72" role="img" aria-label="Bar chart of project count by status. Data table follows.">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 32, left: 8, bottom: 0 }} barCategoryGap={12}>
                <CartesianGrid {...dottedGrid} horizontal={false} />
                <XAxis type="number" allowDecimals={false} {...axisProps} />
                <YAxis type="category" dataKey="label" width={76} {...axisProps} tick={{ ...axisProps.tick, fill: "hsl(var(--foreground))" }} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.6 }} />
                <Bar dataKey="count" name="Projects" fill={C.s1} radius={[0, 4, 4, 0]} maxBarSize={26}>
                  <LabelList dataKey="count" position="right" className="fill-foreground font-mono text-xs" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <table className="sr-only">
            <caption>Projects by status</caption>
            <thead>
              <tr><th scope="col">Status</th><th scope="col">Projects</th></tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.label}><th scope="row">{d.label}</th><td>{d.count}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </ChartPanel>
  );
}
