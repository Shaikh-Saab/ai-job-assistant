import "server-only";
import type { Prisma, Project } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { PROJECT_STATUSES, type ProjectQuery } from "@/lib/validations";

/** JSON shape sent to the client (dates as ISO strings). */
export type ProjectDTO = Omit<Project, "dueDate" | "completedAt" | "createdAt" | "updatedAt" | "userId"> & {
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectPage = {
  data: ProjectDTO[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip userId from the client payload
const toDTO = ({ userId, ...p }: Project): ProjectDTO => ({
  ...p,
  dueDate: p.dueDate?.toISOString() ?? null,
  completedAt: p.completedAt?.toISOString() ?? null,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

type ProjectFilters = Pick<ProjectQuery, "search" | "status" | "priority" | "sort" | "order">;

function buildWhere(userId: string, q: ProjectFilters): Prisma.ProjectWhereInput {
  return {
    userId,
    ...(q.status && { status: q.status }),
    ...(q.priority && { priority: q.priority }),
    ...(q.search && {
      OR: [
        { name: { contains: q.search, mode: "insensitive" } },
        { description: { contains: q.search, mode: "insensitive" } },
      ],
    }),
  };
}

function buildOrderBy(q: ProjectFilters): Prisma.ProjectOrderByWithRelationInput[] {
  return [
    // `nulls` is only valid on nullable columns.
    q.sort === "dueDate" ? { dueDate: { sort: q.order, nulls: "last" } } : { [q.sort]: q.order },
    // Secondary sort on id keeps pagination stable when the primary key ties.
    { id: "asc" },
  ];
}

export async function listProjects(userId: string, q: ProjectQuery): Promise<ProjectPage> {
  const where = buildWhere(userId, q);

  const [total, rows] = await prisma.$transaction([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy: buildOrderBy(q),
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);

  return {
    data: rows.map(toDTO),
    total,
    page: q.page,
    pageSize: q.pageSize,
    pageCount: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}

export type DashboardStats = {
  totals: {
    projects: number;
    active: number;
    completed: number;
    overdue: number;
    budget: number;
    avgProgress: number;
  };
  byStatus: { status: (typeof PROJECT_STATUSES)[number]; count: number }[];
  monthly: { month: string; created: number; completed: number }[];
  /** Open projects with the nearest due dates (overdue first). */
  deadlines: ProjectDTO[];
  updatedAt: string;
};

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1));

  const [grouped, aggregate, overdue, recentCreated, recentCompleted, deadlines] = await prisma.$transaction([
    prisma.project.groupBy({ by: ["status"], where: { userId }, _count: { _all: true }, orderBy: { status: "asc" } }),
    prisma.project.aggregate({ where: { userId }, _sum: { budget: true }, _avg: { progress: true }, _count: { _all: true } }),
    prisma.project.count({ where: { userId, status: { not: "COMPLETED" }, dueDate: { lt: now } } }),
    prisma.project.findMany({ where: { userId, createdAt: { gte: start } }, select: { createdAt: true } }),
    prisma.project.findMany({ where: { userId, completedAt: { gte: start } }, select: { completedAt: true } }),
    prisma.project.findMany({
      where: { userId, status: { not: "COMPLETED" }, dueDate: { not: null } },
      orderBy: { dueDate: "asc" },
      take: 6,
    }),
  ]);

  const counts = Object.fromEntries(
    grouped.map((g) => [g.status, typeof g._count === "object" ? (g._count._all ?? 0) : 0]),
  ) as Record<string, number>;

  // Last 6 calendar months (UTC), oldest first.
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    return {
      key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`,
      month: d.toLocaleString("en-US", { month: "short", timeZone: "UTC" }),
      created: 0,
      completed: 0,
    };
  });
  const byKey = new Map(months.map((m) => [m.key, m]));
  const keyOf = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}`;

  for (const { createdAt } of recentCreated) byKey.get(keyOf(createdAt))!.created++;
  for (const { completedAt } of recentCompleted) {
    const bucket = completedAt && byKey.get(keyOf(completedAt));
    if (bucket) bucket.completed++;
  }

  return {
    totals: {
      projects: aggregate._count._all,
      active: counts.ACTIVE ?? 0,
      completed: counts.COMPLETED ?? 0,
      overdue,
      budget: aggregate._sum.budget ?? 0,
      avgProgress: Math.round(aggregate._avg.progress ?? 0),
    },
    byStatus: PROJECT_STATUSES.map((status) => ({ status, count: counts[status] ?? 0 })),
    monthly: months.map(({ month, created, completed }) => ({ month, created, completed })),
    deadlines: deadlines.map(toDTO),
    updatedAt: now.toISOString(),
  };
}

export const REPORT_ROW_LIMIT = 1000;

/** Every project matching the filters (no pagination), for PDF export. */
export async function getReportProjects(userId: string, q: ProjectFilters): Promise<Project[]> {
  return prisma.project.findMany({
    where: buildWhere(userId, q),
    orderBy: buildOrderBy(q),
    take: REPORT_ROW_LIMIT,
  });
}
