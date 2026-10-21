import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowUpRight, FileText, Settings2, Sparkles } from "lucide-react";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { AddJobDialog } from "@/components/jobs/add-job-dialog";
import { JobFilters } from "@/components/jobs/job-filters";
import { JobStatusBadge, ScoreMark, timeAgo } from "@/components/jobs/job-bits";
import { QuickActions } from "@/components/jobs/quick-actions";
import { SearchButton } from "@/components/jobs/search-button";
import { Button } from "@/components/ui/button";
import { getOrCreateJobProfile, jobStats, listJobs } from "@/lib/data/jobs";
import { aiAllowedFor } from "@/lib/jobs/ai";
import { cn } from "@/lib/utils";
import { JOB_SOURCE_LABELS, JOB_STATUS_LABELS, jobQuerySchema, type JobStatusValue } from "@/lib/validations";

// Job search fans out to ~50 APIs and Claude drafting can take ~a minute.
export const maxDuration = 120;

export const metadata: Metadata = { title: "Job search" };

const TABS: { key: string; label: string; statuses: JobStatusValue[] }[] = [
  { key: "active", label: "To review", statuses: ["NEW", "SHORTLISTED", "PREPARED"] },
  { key: "SHORTLISTED", label: "Shortlisted", statuses: ["SHORTLISTED"] },
  { key: "PREPARED", label: "Ready to submit", statuses: ["PREPARED"] },
  { key: "SUBMITTED", label: "Submitted", statuses: ["SUBMITTED"] },
  { key: "INTERVIEW", label: "Interviews", statuses: ["INTERVIEW", "OFFER"] },
  { key: "all", label: "All", statuses: [] },
];

export default async function JobsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const session = await auth();
  const userId = session!.user.id;
  const raw = await searchParams;
  const q = jobQuerySchema.parse(raw);

  const [profile, stats, jobs] = await Promise.all([getOrCreateJobProfile(userId), jobStats(userId), listJobs(userId, q)]);
  const count = (s: JobStatusValue[]) => s.reduce((a, k) => a + (stats.byStatus[k] ?? 0), 0);
  const total = Object.values(stats.byStatus).reduce<number>((a, b) => a + (b ?? 0), 0);
  const hasResume = profile.resumeText.trim().length >= 200;
  const ai = aiAllowedFor(session!.user.email);

  const tabHref = (key: string) => {
    const p = new URLSearchParams(raw);
    if (key === "active") p.delete("tab");
    else p.set("tab", key);
    return `/jobs${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader
        eyebrow="Job search · entry-level AI & GenAI"
        title="This week’s openings"
        description="Nexus finds and ranks new postings. You review each one, check Claude’s draft, and submit on the employer’s site yourself."
        actions={
          <>
            <Button variant="ghost" asChild>
              <Link href="/jobs/profile">
                <Settings2 aria-hidden="true" /> Job profile
              </Link>
            </Button>
            <AddJobDialog />
            <SearchButton />
          </>
        }
      />

      {/* Setup nudges */}
      {(!hasResume || !ai) && (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-primary/40 bg-accent/50 p-4 text-sm sm:flex-row sm:items-center">
          <Sparkles className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="flex-1">
            {!ai ? (
              <>Claude drafting isn’t available on this account. Everything else works, and you can write each application packet yourself.</>
            ) : (
              <>Paste your resume in Job profile. Claude only writes from facts in it, and can fill in your skills and keywords for you.</>
            )}
          </p>
          {!hasResume && (
            <Button size="sm" variant="outline" asChild>
              <Link href="/jobs/profile">Add resume</Link>
            </Button>
          )}
        </div>
      )}

      {/* Pipeline strip */}
      <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4" aria-label="Pipeline">
        {[
          { label: "New this week", value: stats.newThisWeek },
          { label: "Shortlisted", value: count(["SHORTLISTED"]) },
          { label: "Ready to submit", value: count(["PREPARED"]) },
          { label: "Submitted this week", value: stats.submittedThisWeek },
        ].map((s) => (
          <li key={s.label} className="relative bg-card p-5">
            <p className="eyebrow">{s.label}</p>
            <p className="mt-3 font-dot text-5xl font-black leading-none">{s.value}</p>
          </li>
        ))}
      </ul>

      <section className="overflow-hidden rounded-xl border bg-card">
        <nav aria-label="Pipeline stage" className="flex gap-1 overflow-x-auto border-b px-3 pt-3">
          {TABS.map((t) => {
            const active = q.tab === t.key;
            const n = t.key === "all" ? total : count(t.statuses);
            return (
              <Link
                key={t.key}
                href={tabHref(t.key)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 pb-2.5 pt-1 text-sm font-medium transition-colors",
                  active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
                <span className="rounded-full bg-muted px-1.5 font-mono text-[11px] tabular">{n}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-b bg-muted/30 p-4">
          <Suspense>
            <JobFilters />
          </Suspense>
        </div>

        {jobs.length === 0 ? (
          <div className="relative flex flex-col items-center gap-3 overflow-hidden px-6 py-16 text-center">
            <div className="bg-dots bg-dots-fade absolute inset-0" aria-hidden="true" />
            <p className="relative font-display text-xl font-semibold">
              {total === 0 ? "No jobs yet" : "Nothing here with these filters"}
            </p>
            <p className="relative max-w-md text-sm text-muted-foreground">
              {total === 0
                ? "Run a search to pull this week’s postings from company career sites, Adzuna, Remotive, Himalayas, Jobicy and Arbeitnow."
                : "Try another stage, lower the minimum score, or include older postings."}
            </p>
            {total === 0 && (
              <div className="relative">
                <SearchButton label="Run my first search" />
              </div>
            )}
          </div>
        ) : (
          <ol className="divide-y">
            {jobs.map((j) => (
              <li key={j.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-5 sm:px-5">
                <div className="flex items-start gap-4 sm:contents">
                  <ScoreMark score={j.packet?.fitScore ?? j.score} label={j.packet?.fitScore != null ? "Claude fit" : "Match"} />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/jobs/${j.id}`} className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {j.title}
                      </Link>
                      {j.status !== "NEW" && <JobStatusBadge status={j.status} />}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{j.company}</span> · {j.location || "Location not listed"}
                      {j.salaryText && <> · <span className="tabular">{j.salaryText}</span></>}
                    </p>
                    <ul className="flex flex-wrap gap-1.5" aria-label="Why it matched">
                      {j.signals.slice(0, 4).map((s) => (
                        <li key={s} className="rounded-full border border-dashed px-2 py-0.5 text-[11px] text-muted-foreground">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground" suppressHydrationWarning>
                    {JOB_SOURCE_LABELS[j.source]} · {timeAgo(j.postedAt)}
                  </p>
                  <div className="flex items-center gap-1">
                    <QuickActions id={j.id} status={j.status} title={j.title} />
                    <Button size="sm" asChild>
                      <Link href={`/jobs/${j.id}`}>
                        {j.status === "PREPARED" ? <FileText aria-hidden="true" /> : <ArrowUpRight aria-hidden="true" />}
                        {j.status === "PREPARED" ? "Review" : j.status === "SUBMITTED" ? "Open" : "Prepare"}
                      </Link>
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Sources: company career sites (Greenhouse, Lever, Ashby), Adzuna, Remotive, Himalayas, Arbeitnow, and remote jobs from{" "}
        <a href="https://jobicy.com" target="_blank" rel="noopener" className="underline underline-offset-2">Jobicy</a>. LinkedIn
        jobs can be added by link; Nexus never logs into or automates LinkedIn. Statuses: {Object.values(JOB_STATUS_LABELS).slice(0, 4).join(" → ")}.
      </p>
    </>
  );
}
