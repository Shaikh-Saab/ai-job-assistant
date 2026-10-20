"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star, X } from "lucide-react";
import { toast } from "sonner";

import { setJobStatus } from "@/actions/jobs";
import { Button } from "@/components/ui/button";
import type { JobStatusValue } from "@/lib/validations";

export function QuickActions({ id, status, title }: { id: string; status: JobStatusValue; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const set = (s: JobStatusValue, msg: string) =>
    start(async () => {
      const res = await setJobStatus(id, s);
      if (!res.ok) return void toast.error(res.error);
      toast.success(msg);
      router.refresh();
    });

  if (status !== "NEW" && status !== "SHORTLISTED") return null;
  return (
    <div className="flex gap-1">
      {status === "NEW" && (
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => set("SHORTLISTED", "Shortlisted")} aria-label={`Shortlist ${title}`}>
          <Star aria-hidden="true" /> <span className="hidden sm:inline">Shortlist</span>
        </Button>
      )}
      <Button variant="ghost" size="sm" disabled={pending} onClick={() => set("SKIPPED", "Skipped")} aria-label={`Skip ${title}`}>
        <X aria-hidden="true" /> <span className="hidden sm:inline">Skip</span>
      </Button>
    </div>
  );
}
