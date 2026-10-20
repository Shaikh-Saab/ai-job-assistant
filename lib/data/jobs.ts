import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_ASHBY, DEFAULT_COUNTRIES, DEFAULT_GREENHOUSE, DEFAULT_LEVER, DEFAULT_ROLE_KEYWORDS, DEFAULT_SKILLS,
} from "@/lib/jobs/defaults";
import type { JobQuery } from "@/lib/validations";

/** Every user gets a profile pre-filled for entry-level AI / GenAI roles worldwide. */
export async function getOrCreateJobProfile(userId: string) {
  return prisma.jobProfile.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      roleKeywords: DEFAULT_ROLE_KEYWORDS,
      skills: DEFAULT_SKILLS,
      countries: DEFAULT_COUNTRIES,
      greenhouseBoards: DEFAULT_GREENHOUSE,
      ashbyBoards: DEFAULT_ASHBY,
      leverBoards: DEFAULT_LEVER,
      wantsRelocation: true,
      entryLevelOnly: true,
    },
  });
}

const WEEK_MS = 7 * 86_400_000;
/** "Active" = still in play: not skipped/rejected, and not yet past submission. */
const ACTIVE = ["NEW", "SHORTLISTED", "PREPARED"] as const;

export async function listJobs(userId: string, q: JobQuery) {
  const where: Prisma.JobWhereInput = {
    userId,
    ...(q.tab === "active" ? { status: { in: [...ACTIVE] } } : q.tab === "all" ? {} : { status: q.tab }),
    ...(q.week === "1" && q.tab !== "SUBMITTED" && { postedAt: { gte: new Date(Date.now() - WEEK_MS) } }),
    ...(q.source && { source: q.source as Prisma.EnumJobSourceFilter["equals"] }),
    ...(q.minScore > 0 && { score: { gte: q.minScore } }),
    ...(q.q && {
      OR: [
        { title: { contains: q.q, mode: "insensitive" } },
        { company: { contains: q.q, mode: "insensitive" } },
        { location: { contains: q.q, mode: "insensitive" } },
      ],
    }),
  };
  return prisma.job.findMany({
    where,
    orderBy: [{ score: "desc" }, { postedAt: "desc" }],
    take: 200,
    select: {
      id: true, title: true, company: true, location: true, remote: true, url: true, source: true,
      salaryText: true, postedAt: true, score: true, signals: true, status: true, submittedAt: true,
      packet: { select: { fitScore: true } },
    },
  });
}
export type JobListItem = Awaited<ReturnType<typeof listJobs>>[number];

export async function jobStats(userId: string) {
  const weekAgo = new Date(Date.now() - WEEK_MS);
  const [grouped, newThisWeek, submittedThisWeek] = await prisma.$transaction([
    prisma.job.groupBy({ by: ["status"], where: { userId }, _count: { _all: true }, orderBy: { status: "asc" } }),
    prisma.job.count({ where: { userId, postedAt: { gte: weekAgo }, status: "NEW" } }),
    prisma.job.count({ where: { userId, submittedAt: { gte: weekAgo } } }),
  ]);
  const byStatus = Object.fromEntries(
    grouped.map((g) => [g.status, typeof g._count === "object" ? (g._count._all ?? 0) : 0]),
  ) as Partial<Record<string, number>>;
  return { byStatus, newThisWeek, submittedThisWeek };
}

export async function getJob(userId: string, id: string) {
  return prisma.job.findFirst({ where: { id, userId }, include: { packet: true } });
}
export type JobWithPacket = NonNullable<Awaited<ReturnType<typeof getJob>>>;
