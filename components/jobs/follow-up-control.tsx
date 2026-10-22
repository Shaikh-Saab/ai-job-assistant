"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellRing, CheckCheck } from "lucide-react";
import { toast } from "sonner";

import { markFollowedUp, setFollowUp } from "@/actions/jobs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const plusDays = (n: number) => ymd(new Date(Date.now() + n * 86_400_000));

/** Reminder to chase the employer after submitting. Shown once a job is submitted. */
export function FollowUpControl({ jobId, followUpAt }: { jobId: string; followUpAt: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [date, setDate] = useState(followUpAt ? followUpAt.slice(0, 10) : "");
  const due = !!followUpAt && new Date(followUpAt) <= new Date();

  const run = (fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      router.refresh();
    });

  return (
    <section
      className={cn("space-y-3 rounded-xl border p-5", due ? "border-amber-400/60 bg-amber-50 dark:bg-amber-500/10" : "bg-card")}
      aria-labelledby="fu-h"
    >
      <div className="flex items-center gap-2">
        <BellRing className={cn("h-4 w-4", due ? "text-amber-600" : "text-muted-foreground")} aria-hidden="true" />
        <h2 id="fu-h" className="font-display text-lg font-semibold">
          {due ? "Follow-up due" : "Follow-up reminder"}
        </h2>
      </div>
      <p className="text-sm text-muted-foreground">
        {followUpAt
          ? due
            ? "No reply yet? Send a short, polite check-in to the recruiter or hiring manager."
            : `We’ll remind you on ${new Date(followUpAt).toLocaleDateString()}${" "}if you haven’t heard back.`
          : "No reminder set."}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="fu-date" className="sr-only">Follow-up date</label>
        <Input id="fu-date" type="date" value={date} min={ymd(new Date())} onChange={(e) => setDate(e.target.value)} className="w-44" />
        <Button size="sm" variant="outline" disabled={pending || !date} onClick={() => run(() => setFollowUp(jobId, date))}>Set</Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => { setDate(plusDays(3)); run(() => setFollowUp(jobId, plusDays(3))); }}>+3 days</Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => { setDate(plusDays(7)); run(() => setFollowUp(jobId, plusDays(7))); }}>+7 days</Button>
        {followUpAt && (
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => { setDate(""); run(() => setFollowUp(jobId, null)); }}>Clear</Button>
        )}
      </div>
      {due && (
        <Button size="sm" onClick={() => run(() => markFollowedUp(jobId))} loading={pending}>
          {!pending && <CheckCheck aria-hidden="true" />} I followed up
        </Button>
      )}
    </section>
  );
}
