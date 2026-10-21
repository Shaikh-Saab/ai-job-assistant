import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, ExternalLink, XCircle } from "lucide-react";

import { auth } from "@/auth";
import { JobStatusBadge, ScoreMark, timeAgo } from "@/components/jobs/job-bits";
import { PacketWorkspace } from "@/components/jobs/packet-workspace";
import { StatusSelect } from "@/components/jobs/status-select";
import { DotMeter } from "@/components/ui/dot-meter";
import { getJob, getOrCreateJobProfile } from "@/lib/data/jobs";
import { aiAllowedFor } from "@/lib/jobs/ai";
import { JOB_SOURCE_LABELS } from "@/lib/validations";

// Claude drafting can take about a minute.
export const maxDuration = 120;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const session = await auth();
  const job = session?.user ? await getJob(session.user.id, (await params).id) : null;
  return { title: job ? `${job.title} · ${job.company}` : "Job" };
}

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session!.user.id;
  const { id } = await params;
  const [job, profile] = await Promise.all([getJob(userId, id), getOrCreateJobProfile(userId)]);
  if (!job) notFound();

  const p = job.packet;
  const answers = (Array.isArray(p?.answers) ? p!.answers : []) as { question: string; answer: string }[];

  return (
    <>
      <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Job search
      </Link>

      <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <ScoreMark score={p?.fitScore ?? job.score} label={p?.fitScore != null ? "Claude fit" : "Match"} />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="eyebrow" suppressHydrationWarning>
            {JOB_SOURCE_LABELS[job.source]} · posted {timeAgo(job.postedAt)}
          </p>
          <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">{job.title}</h1>
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">{job.company}</span> · {job.location || "Location not listed"}
            {job.remote && " · Remote"}
            {job.salaryText && <> · <span className="tabular">{job.salaryText}</span></>}
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <JobStatusBadge status={job.status} />
            <a href={job.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
              View posting <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        </div>
        <StatusSelect id={job.id} status={job.status} />
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,520px)]">
        <div className="min-w-0 space-y-6">
          {/* Claude's fit analysis */}
          {p?.fitScore != null && (
            <section className="rounded-xl border bg-card p-5" aria-labelledby="fit-h">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="eyebrow">Claude’s read</p>
                  <h2 id="fit-h" className="font-display text-lg font-semibold">Fit analysis</h2>
                </div>
                <DotMeter value={p.fitScore} dots={20} label="Claude fit score" />
              </div>
              <p className="mt-3 text-sm leading-relaxed">{p.fitSummary}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium">You match</p>
                  <ul className="space-y-1.5 text-sm">
                    {p.strengths.map((s) => (
                      <li key={s} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Gaps to address</p>
                  <ul className="space-y-1.5 text-sm">
                    {p.gaps.length ? p.gaps.map((s) => (
                      <li key={s} className="flex gap-2"><XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />{s}</li>
                    )) : <li className="text-muted-foreground">None flagged.</li>}
                  </ul>
                </div>
              </div>
            </section>
          )}

          <section className="rounded-xl border bg-card p-5" aria-labelledby="why-h">
            <p className="eyebrow">Search match</p>
            <h2 id="why-h" className="font-display text-lg font-semibold">Why it showed up</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {job.signals.map((s) => (
                <li key={s} className="rounded-full border border-dashed px-2.5 py-1 text-xs text-muted-foreground">{s}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border bg-card" aria-labelledby="desc-h">
            <h2 id="desc-h" className="border-b p-5 font-display text-lg font-semibold">Job description</h2>
            <div className="max-h-[70vh] overflow-y-auto whitespace-pre-wrap p-5 text-sm leading-relaxed">
              {job.description || (
                <span className="text-muted-foreground">
                  No description captured. Open the posting and paste the description into a new job link if you want Claude to use it.
                </span>
              )}
            </div>
          </section>
        </div>

        <div className="xl:sticky xl:top-20 xl:self-start">
          <PacketWorkspace
            jobId={job.id}
            jobUrl={job.url}
            status={job.status}
            submittedAt={job.submittedAt?.toISOString() ?? null}
            notes={job.notes}
            aiReady={aiAllowedFor(session!.user.email)}
            hasResume={profile.resumeText.trim().length >= 200}
            packet={
              p
                ? {
                    summary: p.summary,
                    coverLetter: p.coverLetter,
                    answers,
                    checks: p.checks,
                    checklist: (p.checklist as Record<string, boolean>) ?? {},
                    generatedAt: p.generatedAt?.toISOString() ?? null,
                  }
                : null
            }
          />
        </div>
      </div>
    </>
  );
}
