import { Ban, CheckCircle2, Circle, FileCheck2, MessagesSquare, PartyPopper, Send, Star } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { JOB_STATUS_LABELS, type JobStatusValue } from "@/lib/validations";

// Status always shows icon + text; color is a secondary cue.
const STATUS: Record<JobStatusValue, { variant: BadgeProps["variant"]; icon: typeof Circle }> = {
  NEW: { variant: "secondary", icon: Circle },
  SHORTLISTED: { variant: "info", icon: Star },
  PREPARED: { variant: "warning", icon: FileCheck2 },
  SUBMITTED: { variant: "success", icon: Send },
  INTERVIEW: { variant: "success", icon: MessagesSquare },
  OFFER: { variant: "success", icon: PartyPopper },
  REJECTED: { variant: "outline", icon: Ban },
  SKIPPED: { variant: "outline", icon: CheckCircle2 },
};

export function JobStatusBadge({ status }: { status: JobStatusValue }) {
  const { variant, icon: Icon } = STATUS[status];
  return (
    <Badge variant={variant}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {JOB_STATUS_LABELS[status]}
    </Badge>
  );
}

/** Score as a dot-matrix number with a qualitative label. */
export function ScoreMark({ score, label = "Match" }: { score: number; label?: string }) {
  const tone = score >= 80 ? "text-primary" : score >= 60 ? "text-foreground" : "text-muted-foreground";
  return (
    <div className="flex w-14 shrink-0 flex-col items-center" aria-label={`${label} score ${score} out of 100`}>
      <span className={`font-dot text-3xl font-black leading-none ${tone}`}>{score}</span>
      <span className="eyebrow mt-1 text-[9px]">{label}</span>
    </div>
  );
}

export function timeAgo(date: Date | string, now = new Date()) {
  const days = Math.floor((now.getTime() - new Date(date).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
