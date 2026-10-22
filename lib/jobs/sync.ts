import "server-only";
import type { JobProfile } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { FEED_TERMS } from "@/lib/jobs/defaults";
import { scoreJob } from "@/lib/jobs/score";
import { adzuna, arbeitnow, ashby, greenhouse, himalayas, jobicy, lever, pool, remotive } from "@/lib/jobs/sources";
import type { RawJob, SearchSummary } from "@/lib/jobs/types";

const WEEK_MS = 7 * 86_400_000;
/** Postings scoring below this are noise for an entry-level AI search and aren't saved. */
export const MIN_SAVE_SCORE = 35;

/**
 * Fetch this week's postings from every configured source, score them against the profile,
 * and upsert the relevant ones. Existing rows keep their status, notes and packet.
 */
export async function runSearch(userId: string, profile: JobProfile): Promise<SearchSummary> {
  const since = new Date(Date.now() - WEEK_MS);
  const skippedSources: string[] = [];

  const tasks: (() => ReturnType<typeof greenhouse>)[] = [
    ...profile.greenhouseBoards.map((b) => () => greenhouse(b, since)),
    ...profile.ashbyBoards.map((b) => () => ashby(b, since)),
    ...profile.leverBoards.map((b) => () => lever(b, since)),
    () => remotive(FEED_TERMS, since),
    () => himalayas(FEED_TERMS, since),
    () => jobicy(FEED_TERMS.filter((t) => t.length >= 3), since),
    () => arbeitnow(since),
  ];

  const { ADZUNA_APP_ID: appId, ADZUNA_APP_KEY: appKey } = process.env;
  if (appId && appKey) {
    const terms = profile.roleKeywords.flatMap((k) => k.split(/\s+/)).filter((w) => w.length > 1);
    const what = [...new Set(terms.map((t) => t.toLowerCase()))].slice(0, 12);
    tasks.push(...profile.countries.map((c) => () => adzuna(c, what, appId, appKey)));
  } else {
    skippedSources.push("Adzuna (add ADZUNA_APP_ID and ADZUNA_APP_KEY to .env)");
  }

  const results = await pool(tasks, 6, (t) => t());
  const all: RawJob[] = results.flatMap((r) => r.jobs);

  const scoringProfile = {
    roleKeywords: profile.roleKeywords,
    skills: profile.skills,
    minSalaryUsd: profile.minSalaryUsd,
    wantsRelocation: profile.wantsRelocation,
    entryLevelOnly: profile.entryLevelOnly,
    preferredLocations: profile.preferredLocations,
  };

  const matches = all
    .map((job) => ({ job, ...scoreJob(job, scoringProfile) }))
    .filter(
      (m) =>
        m.relevant &&
        !(profile.entryLevelOnly && m.senior) &&
        !(profile.onlyPreferredLocations && m.outsidePreferredLocations) &&
        m.score >= MIN_SAVE_SCORE,
    );

  // The same role can appear in several feeds; keep the highest-scoring copy per company+title.
  const best = new Map<string, (typeof matches)[number]>();
  for (const m of matches) {
    const key = `${m.job.company.toLowerCase()}|${m.job.title.toLowerCase()}`;
    if (!best.has(key) || best.get(key)!.score < m.score) best.set(key, m);
  }

  const existing = new Set(
    (
      await prisma.job.findMany({
        where: { userId, OR: [...best.values()].map((m) => ({ source: m.job.source, externalId: m.job.externalId })) },
        select: { source: true, externalId: true },
      })
    ).map((j) => `${j.source}|${j.externalId}`),
  );

  let added = 0;
  let updated = 0;
  const newJobIds: string[] = [];
  for (const chunk of chunked([...best.values()], 25)) {
    const saved = await prisma.$transaction(
      chunk.map(({ job, score, signals }) => {
        const isNew = !existing.has(`${job.source}|${job.externalId}`);
        if (isNew) added++;
        else updated++;
        const data = {
          company: job.company.slice(0, 160), title: job.title.slice(0, 240), location: job.location.slice(0, 240),
          remote: job.remote, url: job.url.slice(0, 1000), description: job.description,
          salaryText: job.salaryText?.slice(0, 160) ?? null, salaryMinUsd: job.salaryMinUsd ?? null,
          postedAt: job.postedAt, score, signals,
        };
        return prisma.job.upsert({
          where: { userId_source_externalId: { userId, source: job.source, externalId: job.externalId } },
          create: { userId, source: job.source, externalId: job.externalId, ...data },
          update: data, // status, notes and packet are left untouched
          select: { id: true },
        });
      }),
    );
    // $transaction keeps order, so saved[i] corresponds to chunk[i].
    newJobIds.push(
      ...saved.filter((_, i) => !existing.has(`${chunk[i].job.source}|${chunk[i].job.externalId}`)).map((j) => j.id),
    );
  }
  if (newJobIds.length) {
    await prisma.jobEvent.createMany({ data: newJobIds.map((jobId) => ({ jobId, type: "FOUND" as const, detail: "Found by job search" })) });
  }

  return {
    reports: results.map((r) => r.report),
    scanned: all.length,
    matched: best.size,
    added,
    updated,
    skippedSources,
    newJobIds,
  };
}

function chunked<T>(arr: T[], size: number) {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
}
