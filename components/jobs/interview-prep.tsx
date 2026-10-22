"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { prepareInterview } from "@/actions/jobs";
import { Button } from "@/components/ui/button";
import type { InterviewPrep as Prep } from "@/lib/jobs/ai";

/** Claude interview coaching for one job (owner-only when deployed publicly). */
export function InterviewPrep({ jobId, prep, aiReady }: { jobId: string; prep: Prep | null; aiReady: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      const res = await prepareInterview(jobId);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      router.refresh();
    });

  return (
    <section className="rounded-xl border bg-card" aria-labelledby="prep-h">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
        <div className="space-y-1">
          <p className="eyebrow">Interview</p>
          <h2 id="prep-h" className="flex items-center gap-2 font-display text-lg font-semibold">
            <GraduationCap className="h-5 w-5" aria-hidden="true" /> Interview prep
          </h2>
          <p className="text-xs text-muted-foreground">Likely questions, answer outlines from your resume, and questions to ask them.</p>
        </div>
        <Button size="sm" variant={prep ? "outline" : "default"} onClick={run} loading={pending} disabled={!aiReady}>
          {!pending && (prep ? <RefreshCw aria-hidden="true" /> : <Sparkles aria-hidden="true" />)}
          {pending ? "Claude is preparing…" : prep ? "Regenerate" : "Prepare with Claude"}
        </Button>
      </header>

      {!prep ? (
        <p className="p-5 text-sm text-muted-foreground">
          {aiReady ? "Generate a prep sheet when you get an interview invite." : "Claude interview prep is available to the site owner only."}
        </p>
      ) : (
        <div className="space-y-6 p-5 text-sm">
          <div>
            <h3 className="mb-2 font-medium">Likely questions</h3>
            <ol className="space-y-3">
              {prep.questions.map((q, i) => (
                <li key={i} className="rounded-lg border border-dashed p-3">
                  <p className="font-medium">{i + 1}. {q.question}</p>
                  <p className="mt-1 text-xs text-muted-foreground">Why they ask: {q.why}</p>
                  <p className="mt-2 whitespace-pre-wrap">{q.answerOutline}</p>
                </li>
              ))}
            </ol>
          </div>
          {[
            ["Stories to prepare (STAR)", prep.storiesToPrepare],
            ["Topics to revise", prep.technicalTopics],
            ["Questions to ask them", prep.questionsToAsk],
          ].map(([title, items]) => (
            <div key={title as string}>
              <h3 className="mb-2 font-medium">{title as string}</h3>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                {(items as string[]).map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
