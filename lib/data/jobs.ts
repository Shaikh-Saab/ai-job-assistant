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
    ...(q.tab === "active"
      ? { status: { in: [...ACTIVE] } }
      : q.tab === "FOLLOWUP"
        ? { status: "SUBMITTED", followUpAt: { lte: new Date() } }
        : q.tab === "all"
          ? {}
          : { status: q.tab }),
    // "This week" applies to discovery stages only; submitted work stays visible however old.
    ...(q.week === "1" && ["active", "NEW", "SHORTLISTED", "PREPARED"].includes(q.tab) && {
      postedAt: { gte: new Date(Date.now() - WEEK_MS) },
    }),
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
      salaryText: true, postedAt: true, score: true, signals: true, status: true, submittedAt: true, followUpAt: true,
      packet: { select: { fitScore: true } },
    },
  });
}
export type JobListItem = Awaited<ReturnType<typeof listJobs>>[number];

export async function jobStats(userId: string) {
  const weekAgo = new Date(Date.now() - WEEK_MS);
  const [grouped, newThisWeek, submittedThisWeek, followUpsDue] = await prisma.$transaction([
    prisma.job.groupBy({ by: ["status"], where: { userId }, _count: { _all: true }, orderBy: { status: "asc" } }),
    prisma.job.count({ where: { userId, postedAt: { gte: weekAgo }, status: "NEW" } }),
    prisma.job.count({ where: { userId, submittedAt: { gte: weekAgo } } }),
    prisma.job.count({ where: { userId, status: "SUBMITTED", followUpAt: { lte: new Date() } } }),
  ]);
  const byStatus = Object.fromEntries(
    grouped.map((g) => [g.status, typeof g._count === "object" ? (g._count._all ?? 0) : 0]),
  ) as Partial<Record<string, number>>;
  return { byStatus, newThisWeek, submittedThisWeek, followUpsDue };
}

export async function getJob(userId: string, id: string) {
  return prisma.job.findFirst({
    where: { id, userId },
    include: { packet: true, events: { orderBy: { createdAt: "desc" }, take: 50 } },
  });
}

// ---------- Insights ----------

const ORDER = ["NEW", "SHORTLISTED", "PREPARED", "SUBMITTED", "INTERVIEW", "OFFER"] as const;
const reached = (status: string, stage: (typeof ORDER)[number]) =>
  // REJECTED / SKIPPED don't say how far a job got, so they only count as "found".
  ORDER.indexOf(status as (typeof ORDER)[number]) >= ORDER.indexOf(stage);

/** Funnel, response rate, per-source and weekly numbers for the insights page. */
export async function jobInsights(userId: string) {
  const jobs = await prisma.job.findMany({
    where: { userId },
    select: { status: true, source: true, score: true, submittedAt: true, events: { where: { type: "SUBMITTED" }, select: { id: true } } },
  });
  // A job that was submitted and later rejected still counts as submitted.
  const wasSubmitted = (j: (typeof jobs)[number]) => !!j.submittedAt || j.events.length > 0 || reached(j.status, "SUBMITTED");

  const funnel = [
    { stage: "Found", count: jobs.length },
    { stage: "Shortlisted", count: jobs.filter((j) => reached(j.status, "SHORTLISTED") || wasSubmitted(j)).length },
    { stage: "Prepared", count: jobs.filter((j) => reached(j.status, "PREPARED") || wasSubmitted(j)).length },
    { stage: "Submitted", count: jobs.filter(wasSubmitted).length },
    { stage: "Interview", count: jobs.filter((j) => reached(j.status, "INTERVIEW")).length },
    { stage: "Offer", count: jobs.filter((j) => j.status === "OFFER").length },
  ];
  const submitted = funnel[3].count;
  const responses = jobs.filter((j) => ["INTERVIEW", "OFFER", "REJECTED"].includes(j.status) && wasSubmitted(j)).length;

  const sources = Object.entries(
    jobs.reduce<Record<string, { found: number; submitted: number; interviews: number }>>((acc, j) => {
      const s = (acc[j.source] ??= { found: 0, submitted: 0, interviews: 0 });
      s.found++;
      if (wasSubmitted(j)) s.submitted++;
      if (reached(j.status, "INTERVIEW")) s.interviews++;
      return acc;
    }, {}),
  )
    .map(([source, v]) => ({ source, ...v }))
    .sort((a, b) => b.found - a.found);

  // Submissions per week for the last 8 weeks (oldest first).
  const now = Date.now();
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = now - (7 - i) * 7 * 86_400_000;
    const start = end - 7 * 86_400_000;
    return {
      label: new Date(end).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count: jobs.filter((j) => j.submittedAt && j.submittedAt.getTime() > start && j.submittedAt.getTime() <= end).length,
    };
  });

  const submittedScores = jobs.filter(wasSubmitted).map((j) => j.score);
  return {
    funnel,
    responseRate: submitted ? Math.round((responses / submitted) * 100) : null,
    interviewRate: submitted ? Math.round((funnel[4].count / submitted) * 100) : null,
    avgSubmittedScore: submittedScores.length ? Math.round(submittedScores.reduce((a, b) => a + b, 0) / submittedScores.length) : null,
    sources,
    weeks,
  };
}

/** Every job (newest first) for CSV export. */
export async function jobsForExport(userId: string) {
  return prisma.job.findMany({
    where: { userId },
    orderBy: [{ status: "asc" }, { score: "desc" }],
    include: { packet: { select: { fitScore: true } } },
    take: 5000,
  });
}
export type JobWithPacket = NonNullable<Awaited<ReturnType<typeof getJob>>>;
