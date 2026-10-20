"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Radar } from "lucide-react";
import { toast } from "sonner";

import { searchJobs } from "@/actions/jobs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { SearchSummary } from "@/lib/jobs/types";
import { JOB_SOURCE_LABELS } from "@/lib/validations";

export function SearchButton({ label = "Find this week’s jobs" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState<SearchSummary | null>(null);

  const run = () =>
    startTransition(async () => {
      const res = await searchJobs();
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      setSummary(res.data ?? null);
      router.refresh();
    });

  const failed = summary?.reports.filter((r) => r.error) ?? [];
  // Collapse per-board rows into one row per source for the summary.
  const bySource = Object.entries(
    (summary?.reports ?? []).reduce<Record<string, { boards: number; fetched: number }>>((acc, r) => {
      const a = (acc[r.source] ??= { boards: 0, fetched: 0 });
      a.boards++;
      a.fetched += r.fetched;
      return acc;
    }, {}),
  );

  return (
    <>
      <Button onClick={run} loading={pending}>
        {!pending && <Radar aria-hidden="true" />}
        {pending ? "Searching ~50 sources…" : label}
      </Button>

      <Dialog open={!!summary} onOpenChange={(o) => !o && setSummary(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Search complete</DialogTitle>
            <DialogDescription>
              Scanned {summary?.scanned.toLocaleString()} postings from the last 7 days. {summary?.matched} matched your
              profile: {summary?.added} new, {summary?.updated} refreshed.
            </DialogDescription>
          </DialogHeader>

          <ul className="divide-y divide-dashed rounded-lg border text-sm">
            {bySource.map(([source, v]) => (
              <li key={source} className="flex items-center justify-between px-3 py-2">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  {JOB_SOURCE_LABELS[source] ?? source}
                  {v.boards > 1 && <span className="text-xs text-muted-foreground">({v.boards} boards)</span>}
                </span>
                <span className="font-mono text-xs tabular">{v.fetched} this week</span>
              </li>
            ))}
          </ul>

          {(failed.length > 0 || (summary?.skippedSources.length ?? 0) > 0) && (
            <div className="space-y-1 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <p className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Some sources were skipped
              </p>
              <ul className="list-inside list-disc text-xs">
                {summary?.skippedSources.map((s) => <li key={s}>{s}</li>)}
                {failed.map((r) => (
                  <li key={`${r.source}-${r.label}`}>
                    {JOB_SOURCE_LABELS[r.source]} · {r.label}: {r.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
