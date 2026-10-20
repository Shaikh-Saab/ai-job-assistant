"use client";

import Link from "next/link";
import { FileDown, Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { ActivityChart, StatusChart } from "@/components/dashboard/charts";
import { Deadlines } from "@/components/dashboard/deadlines";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { useStats } from "@/hooks/use-projects";
import { useUIStore } from "@/store/ui-store";

export function DashboardView({ firstName }: { firstName?: string }) {
  const { data, isFetching, isError, refetch, dataUpdatedAt } = useStats();
  const openCreateProject = useUIStore((s) => s.openCreateProject);

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={firstName ? `Welcome back, ${firstName}` : "Dashboard"}
        description="Here’s how your projects are tracking."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/reports">
                <FileDown aria-hidden="true" /> Export PDF
              </Link>
            </Button>
            <Button onClick={openCreateProject}>
              <Plus aria-hidden="true" /> New project
            </Button>
          </>
        }
      />

      {/* Not aria-live: a timestamp announced every 15s would be noise for screen readers. */}
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
        <span className="relative flex h-2 w-2" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        {/* Server and browser may format the time differently; that mismatch is expected. */}
        <span suppressHydrationWarning>
          Live · {dataUpdatedAt ? `updated ${new Date(dataUpdatedAt).toLocaleTimeString()}` : "loading…"}
        </span>
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => refetch()} aria-label="Refresh statistics">
          <RefreshCw className={isFetching ? "animate-spin" : undefined} aria-hidden="true" />
        </Button>
      </div>

      {isError && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Couldn’t load statistics. Retrying automatically.
        </p>
      )}

      <StatsCards stats={data} />

      <div className="grid gap-6 xl:grid-cols-5">
        <ActivityChart data={data?.monthly} className="xl:col-span-3" />
        <StatusChart data={data?.byStatus} className="xl:col-span-2" />
      </div>

      <Deadlines items={data?.deadlines} />
    </>
  );
}
