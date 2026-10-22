import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { DotMeter } from "@/components/ui/dot-meter";
import { jobInsights } from "@/lib/data/jobs";
import { JOB_SOURCE_LABELS } from "@/lib/validations";

export const metadata: Metadata = { title: "Job search insights" };

export default async function InsightsPage() {
  const session = await auth();
  const ins = await jobInsights(session!.user.id);
  const top = Math.max(1, ins.funnel[0].count);
  const maxWeek = Math.max(1, ...ins.weeks.map((w) => w.count));

  const kpis = [
    { label: "Response rate", value: ins.responseRate, note: "Replies (interview, offer or rejection) per application" },
    { label: "Interview rate", value: ins.interviewRate, note: "Applications that reached an interview" },
    { label: "Avg. match of applied jobs", value: ins.avgSubmittedScore, note: "Are you applying to strong fits?" },
  ];

  return (
    <>
      <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Job search
      </Link>
      <PageHeader eyebrow="Job search" title="Insights" description="How your search is converting, where your best leads come from, and your weekly pace." />

      <ul className="grid gap-4 md:grid-cols-3" aria-label="Key rates">
        {kpis.map((k) => (
          <li key={k.label} className="space-y-3 rounded-xl border bg-card p-5">
            <p className="eyebrow">{k.label}</p>
            <p className="font-dot text-5xl font-black leading-none">{k.value === null ? "–" : `${k.value}${k.label.startsWith("Avg") ? "" : "%"}`}</p>
            {k.value !== null && <DotMeter value={k.value} dots={14} label={k.label} />}
            <p className="text-xs text-muted-foreground">{k.value === null ? "Submit a few applications to see this." : k.note}</p>
          </li>
        ))}
      </ul>

      <section className="rounded-xl border bg-card p-6" aria-labelledby="funnel-h">
        <p className="eyebrow">Pipeline</p>
        <h2 id="funnel-h" className="font-display text-xl font-semibold">Funnel</h2>
        <ol className="mt-5 space-y-3">
          {ins.funnel.map((f, i) => {
            const prev = i === 0 ? null : ins.funnel[i - 1].count;
            const conv = prev ? Math.round((f.count / prev) * 100) : null;
            return (
              <li key={f.stage} className="grid grid-cols-[6.5rem_minmax(0,1fr)_3.5rem] items-center gap-3 sm:grid-cols-[8rem_minmax(0,1fr)_4rem_6rem]">
                <span className="text-sm font-medium">{f.stage}</span>
                <span className="h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${f.stage}: ${f.count}`}>
                  <span className="block h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${(f.count / top) * 100}%` }} />
                </span>
                <span className="text-right font-mono text-sm tabular">{f.count}</span>
                <span className="hidden text-right text-xs text-muted-foreground sm:block">{conv === null ? "" : `${conv}% of previous`}</span>
              </li>
            );
          })}
        </ol>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border bg-card p-6" aria-labelledby="weeks-h">
          <p className="eyebrow">Pace</p>
          <h2 id="weeks-h" className="font-display text-xl font-semibold">Applications per week</h2>
          <div className="mt-6 flex h-40 items-end gap-2" role="img" aria-label={`Applications per week: ${ins.weeks.map((w) => `${w.label} ${w.count}`).join(", ")}`}>
            {ins.weeks.map((w) => (
              <div key={w.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="font-mono text-[11px] tabular">{w.count}</span>
                <span className="w-full max-w-10 rounded-t bg-[var(--chart-1)]" style={{ height: `${Math.max(2, (w.count / maxWeek) * 120)}px` }} />
                <span className="font-mono text-[10px] text-muted-foreground">{w.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border bg-card" aria-labelledby="src-h">
          <div className="p-6 pb-3">
            <p className="eyebrow">Sources</p>
            <h2 id="src-h" className="font-display text-xl font-semibold">Where your leads come from</h2>
          </div>
          {ins.sources.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">Run a job search to see sources.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-6 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 text-right font-medium">Found</th>
                  <th className="px-3 py-2 text-right font-medium">Applied</th>
                  <th className="px-6 py-2 text-right font-medium">Interviews</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dashed">
                {ins.sources.map((s) => (
                  <tr key={s.source}>
                    <td className="px-6 py-2.5">{JOB_SOURCE_LABELS[s.source] ?? s.source}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular">{s.found}</td>
                    <td className="px-3 py-2.5 text-right font-mono tabular">{s.submitted}</td>
                    <td className="px-6 py-2.5 text-right font-mono tabular">{s.interviews}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
