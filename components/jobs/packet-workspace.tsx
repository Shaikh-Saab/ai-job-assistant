"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Copy, ExternalLink, Plus, RefreshCw, Save, Send, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { generatePacket, markSubmitted, saveJobNotes, savePacket, setChecklistItem } from "@/actions/jobs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SUBMIT_CHECKLIST, type ChecklistKey, type PacketInput } from "@/lib/validations";

type Props = {
  jobId: string;
  jobUrl: string;
  status: string;
  submittedAt: string | null;
  notes: string;
  aiReady: boolean;
  hasResume: boolean;
  packet: (PacketInput & { checks: string[]; checklist: Record<string, boolean>; generatedAt: string | null }) | null;
};

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs"
      disabled={!text.trim()}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          toast.error("Couldn’t copy. Select the text and copy it manually.");
        }
      }}
      aria-label={`Copy ${label}`}
    >
      {done ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />} {done ? "Copied" : "Copy"}
    </Button>
  );
}

export function PacketWorkspace({ jobId, jobUrl, status, submittedAt, notes: initialNotes, aiReady, hasResume, packet }: Props) {
  const router = useRouter();
  const [generating, startGen] = useTransition();
  const [saving, startSave] = useTransition();
  const [submitting, startSubmit] = useTransition();

  const [draft, setDraft] = useState<PacketInput>({
    summary: packet?.summary ?? "",
    coverLetter: packet?.coverLetter ?? "",
    answers: packet?.answers ?? [],
  });
  const [dirty, setDirty] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(packet?.checklist ?? {});
  const [notes, setNotes] = useState(initialNotes);

  // A fresh draft from Claude replaces the editor contents.
  useEffect(() => {
    setDraft({ summary: packet?.summary ?? "", coverLetter: packet?.coverLetter ?? "", answers: packet?.answers ?? [] });
    setDirty(false);
  }, [packet?.generatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const edit = (patch: Partial<PacketInput>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setDirty(true);
  };
  const editAnswer = (i: number, patch: Partial<PacketInput["answers"][number]>) =>
    edit({ answers: draft.answers.map((a, idx) => (idx === i ? { ...a, ...patch } : a)) });

  const generate = () =>
    startGen(async () => {
      // A redraft replaces the editor; never silently throw away the user's edits.
      if (dirty) return void toast.error("Save your edits first. A redraft would replace them.");
      const res = await generatePacket(jobId);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      router.refresh();
    });

  const save = () =>
    startSave(async () => {
      const res = await savePacket(jobId, draft);
      if (!res.ok) return void toast.error(res.error);
      setDirty(false);
      toast.success(res.message);
      router.refresh();
    });

  const toggle = async (key: ChecklistKey, value: boolean) => {
    setChecklist((c) => ({ ...c, [key]: value }));
    const res = await setChecklistItem(jobId, key, value);
    if (!res.ok) {
      setChecklist((c) => ({ ...c, [key]: !value }));
      toast.error(res.error);
    }
  };

  const ticked = SUBMIT_CHECKLIST.filter((c) => checklist[c.key]).length;
  const allTicked = ticked === SUBMIT_CHECKLIST.length;
  const placeholdersLeft = /\[[^\]]+\]/.test(`${draft.summary}\n${draft.coverLetter}\n${draft.answers.map((a) => a.answer).join("\n")}`);
  const done = status === "SUBMITTED" || status === "INTERVIEW" || status === "OFFER";

  const submit = () =>
    startSubmit(async () => {
      const res = await markSubmitted(jobId);
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      router.refresh();
    });

  const hasDraft = !!(draft.summary || draft.coverLetter || draft.answers.length);

  return (
    <div className="space-y-6">
      {/* 1 · Draft */}
      <section className="rounded-xl border bg-card" aria-labelledby="draft-h">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
          <div className="space-y-1">
            <p className="eyebrow">Step 1 · Draft</p>
            <h2 id="draft-h" className="font-display text-lg font-semibold">Application packet</h2>
            <p className="text-xs text-muted-foreground">
              {packet?.generatedAt
                ? `Drafted by Claude ${new Date(packet.generatedAt).toLocaleString()}. Edit freely.`
                : "Claude writes a tailored summary, cover letter and answers from your resume."}
            </p>
          </div>
          <Button
            variant={hasDraft ? "outline" : "default"}
            size="sm"
            onClick={generate}
            loading={generating}
            disabled={!aiReady || !hasResume}
            title={!aiReady ? "Add ANTHROPIC_API_KEY to .env" : !hasResume ? "Add your resume in Job profile" : undefined}
          >
            {!generating && (hasDraft ? <RefreshCw aria-hidden="true" /> : <Sparkles aria-hidden="true" />)}
            {generating ? "Claude is writing…" : hasDraft ? "Redraft" : "Draft with Claude"}
          </Button>
        </header>

        <div className="space-y-5 p-5">
          {!aiReady && <p className="text-sm text-muted-foreground">Claude isn’t configured. You can still write the packet yourself below.</p>}
          {aiReady && !hasResume && (
            <p className="text-sm text-muted-foreground">
              Add your resume in <Link href="/jobs/profile" className="underline">Job profile</Link> to enable drafting.
            </p>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="pk-summary">Professional summary</Label>
              <CopyButton text={draft.summary} label="summary" />
            </div>
            <Textarea id="pk-summary" rows={4} value={draft.summary} onChange={(e) => edit({ summary: e.target.value })} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="pk-cover">Cover letter</Label>
              <CopyButton text={draft.coverLetter} label="cover letter" />
            </div>
            <Textarea id="pk-cover" rows={10} value={draft.coverLetter} onChange={(e) => edit({ coverLetter: e.target.value })} />
            <p className="text-right font-mono text-[11px] text-muted-foreground tabular">
              {draft.coverLetter.trim() ? draft.coverLetter.trim().split(/\s+/).length : 0} words
            </p>
          </div>

          <fieldset className="space-y-3">
            <legend className="mb-1 text-sm font-medium">Screening answers</legend>
            {draft.answers.map((a, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-dashed p-3">
                <div className="flex items-start gap-2">
                  <label htmlFor={`pk-q-${i}`} className="sr-only">Question {i + 1}</label>
                  <input
                    id={`pk-q-${i}`}
                    value={a.question}
                    onChange={(e) => editAnswer(i, { question: e.target.value })}
                    className="flex-1 bg-transparent text-sm font-medium outline-none focus-visible:underline"
                  />
                  <CopyButton text={a.answer} label={`answer ${i + 1}`} />
                  <Button type="button" variant="ghost" size="sm" className="h-7 px-2" aria-label={`Remove question ${i + 1}`} onClick={() => edit({ answers: draft.answers.filter((_, idx) => idx !== i) })}>
                    <Trash2 aria-hidden="true" />
                  </Button>
                </div>
                <label htmlFor={`pk-a-${i}`} className="sr-only">Answer {i + 1}</label>
                <Textarea id={`pk-a-${i}`} rows={4} value={a.answer} onChange={(e) => editAnswer(i, { answer: e.target.value })} />
              </div>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={() => edit({ answers: [...draft.answers, { question: "New question", answer: "" }] })}>
              <Plus aria-hidden="true" /> Add a question
            </Button>
          </fieldset>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground" aria-live="polite">{dirty ? "Unsaved changes" : "All changes saved"}</p>
            <Button size="sm" onClick={save} loading={saving} disabled={!dirty}>
              {!saving && <Save aria-hidden="true" />} Save packet
            </Button>
          </div>
        </div>
      </section>

      {/* 2 · Verify */}
      <section className="rounded-xl border bg-card" aria-labelledby="verify-h">
        <header className="space-y-1 border-b p-5">
          <p className="eyebrow">Step 2 · Double-check</p>
          <h2 id="verify-h" className="font-display text-lg font-semibold">Before you submit</h2>
        </header>
        <div className="space-y-4 p-5">
          {(packet?.checks.length ?? 0) > 0 && (
            <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              <p className="mb-1.5 flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Claude flagged these for you
              </p>
              <ul className="list-inside list-disc space-y-0.5">
                {packet!.checks.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
          )}
          {placeholdersLeft && (
            <p className="flex items-center gap-2 text-sm font-medium text-red-700 dark:text-red-400" role="status">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" /> Your draft still contains [bracketed placeholders].
            </p>
          )}
          <ul className="space-y-2">
            {SUBMIT_CHECKLIST.map((c) => {
              const on = !!checklist[c.key];
              return (
                <li key={c.key}>
                  <label className={cn("flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring", on ? "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10" : "hover:bg-muted")}>
                    <input type="checkbox" className="mt-0.5 h-4 w-4 accent-emerald-600" checked={on} disabled={done} onChange={(e) => toggle(c.key, e.target.checked)} />
                    {c.label}
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">{ticked} of {SUBMIT_CHECKLIST.length} checked</p>
        </div>
      </section>

      {/* 3 · Submit (on the employer's site) */}
      <section className="relative overflow-hidden rounded-xl border bg-[hsl(var(--ink-panel))] p-5 text-white" aria-labelledby="submit-h">
        <div className="bg-dots-fine absolute inset-0 text-white/10" aria-hidden="true" />
        <div className="relative space-y-4">
          <div className="space-y-1">
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white/60">Step 3 · Submit</p>
            <h2 id="submit-h" className="font-display text-lg font-semibold">You click submit</h2>
            <p className="text-sm text-white/70">
              Open the application, paste from your packet, and press the employer’s submit button yourself. Then confirm here.
            </p>
          </div>
          {done ? (
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-300">
              <Check className="h-4 w-4" aria-hidden="true" /> Submitted {submittedAt ? new Date(submittedAt).toLocaleDateString() : ""}
            </p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="bg-white text-[#0e1726] hover:bg-white/90">
                <a href={jobUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink aria-hidden="true" /> Open application
                </a>
              </Button>
              <Button
                variant="outline"
                className="border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white"
                onClick={submit}
                loading={submitting}
                disabled={!allTicked}
                title={!allTicked ? "Tick every checklist item first" : undefined}
              >
                {!submitting && <Send aria-hidden="true" />} I submitted it
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* Notes */}
      <section className="space-y-2 rounded-xl border bg-card p-5">
        <Label htmlFor="job-notes">Notes</Label>
        <Textarea id="job-notes" rows={3} placeholder="Recruiter name, referral, follow-up date…" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="ghost"
            disabled={notes === initialNotes}
            onClick={async () => {
              const res = await saveJobNotes(jobId, notes);
              if (res.ok) {
                toast.success(res.message);
                router.refresh();
              } else toast.error(res.error);
            }}
          >
            Save notes
          </Button>
        </div>
      </section>
    </div>
  );
}
