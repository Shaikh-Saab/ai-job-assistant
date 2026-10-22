import "server-only";
import type { JobEventType, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

/** Append one entry to a job's activity history. History is never edited, only added to. */
export function logJobEvent(db: Db, jobId: string, type: JobEventType, detail = "") {
  return db.jobEvent.create({ data: { jobId, type, detail: detail.slice(0, 300) } });
}

export const EVENT_LABELS: Record<JobEventType, string> = {
  FOUND: "Found",
  STATUS: "Status changed",
  DRAFTED: "Claude drafted the packet",
  PACKET_SAVED: "Packet edited",
  SUBMITTED: "Submitted",
  FOLLOW_UP_SET: "Follow-up scheduled",
  FOLLOWED_UP: "Followed up",
  INTERVIEW_PREP: "Interview prep generated",
};
