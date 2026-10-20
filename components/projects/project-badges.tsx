import { ArrowDown, ArrowRight, ArrowUp, CheckCircle2, Circle, PauseCircle, PlayCircle } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { DotMeter } from "@/components/ui/dot-meter";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/validations";
import type { ProjectDTO } from "@/lib/data/projects";

// Status is never conveyed by color alone: each badge has an icon and a text label.
const STATUS: Record<ProjectDTO["status"], { variant: BadgeProps["variant"]; icon: typeof Circle }> = {
  PLANNING: { variant: "secondary", icon: Circle },
  ACTIVE: { variant: "info", icon: PlayCircle },
  ON_HOLD: { variant: "warning", icon: PauseCircle },
  COMPLETED: { variant: "success", icon: CheckCircle2 },
};

const PRIORITY: Record<ProjectDTO["priority"], { variant: BadgeProps["variant"]; icon: typeof Circle }> = {
  LOW: { variant: "outline", icon: ArrowDown },
  MEDIUM: { variant: "outline", icon: ArrowRight },
  HIGH: { variant: "danger", icon: ArrowUp },
};

export function StatusBadge({ status }: { status: ProjectDTO["status"] }) {
  const { variant, icon: Icon } = STATUS[status];
  return (
    <Badge variant={variant}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: ProjectDTO["priority"] }) {
  const { variant, icon: Icon } = PRIORITY[priority];
  return (
    <Badge variant={variant}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <DotMeter value={value} />
      <span className="w-9 font-mono text-xs tabular text-muted-foreground">{value}%</span>
    </div>
  );
}
