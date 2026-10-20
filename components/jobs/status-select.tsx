"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { setJobStatus } from "@/actions/jobs";
import { NativeSelect } from "@/components/ui/native-select";
import { JOB_STATUSES, JOB_STATUS_LABELS, type JobStatusValue } from "@/lib/validations";

/** Manual status changes. "Submitted" is only reachable through the checklist flow. */
export function StatusSelect({ id, status }: { id: string; status: JobStatusValue }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <NativeSelect
      aria-label="Application status"
      value={status}
      disabled={pending}
      className="w-48"
      onChange={(e) =>
        start(async () => {
          const res = await setJobStatus(id, e.target.value as JobStatusValue);
          if (!res.ok) return void toast.error(res.error);
          toast.success(res.message);
          router.refresh();
        })
      }
    >
      {JOB_STATUSES.map((s) => (
        <option key={s} value={s} disabled={s === "SUBMITTED" && status !== "SUBMITTED"}>
          {JOB_STATUS_LABELS[s]}
        </option>
      ))}
    </NativeSelect>
  );
}
