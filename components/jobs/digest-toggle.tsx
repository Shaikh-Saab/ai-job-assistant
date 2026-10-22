"use client";

import { useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";

import { setDailyDigest } from "@/actions/jobs";
import { Switch } from "@/components/ui/switch";

/** Opt in to the daily auto-search + email digest (sent each morning by the cron job). */
export function DigestToggle({ enabled, emailReady }: { enabled: boolean; emailReady: boolean }) {
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();

  return (
    <section className="flex items-start gap-4 rounded-xl border bg-card p-5" aria-labelledby="digest-h">
      <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
      <div className="flex-1 space-y-1">
        <h2 id="digest-h" className="font-medium">Daily digest</h2>
        <p className="text-sm text-muted-foreground">
          Every morning Nexus runs your search automatically and emails you the best new matches and any follow-ups that are due.
          {!emailReady && " Email isn’t set up on this site yet, so searches still run but no email is sent."}
        </p>
      </div>
      <Switch
        checked={on}
        disabled={pending}
        aria-label="Daily digest"
        onCheckedChange={(v) => {
          setOn(v);
          start(async () => {
            const res = await setDailyDigest(v);
            if (!res.ok) {
              setOn(!v);
              return void toast.error(res.error);
            }
            toast.success(res.message);
          });
        }}
      />
    </section>
  );
}
