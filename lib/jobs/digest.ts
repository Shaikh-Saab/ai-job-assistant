import "server-only";
import { prisma } from "@/lib/prisma";
import { emailConfigured, sendDigestEmail } from "@/lib/mail";
import { runSearch } from "@/lib/jobs/sync";

const DAY_MS = 86_400_000;

export type DigestResult = { userId: string; newMatches: number; followUpsDue: number; emailed: boolean; error?: string };

/**
 * For each user with the daily digest on: run their job search, then email the best new
 * matches and any follow-ups that are due. Stops before `budgetMs` so the request finishes
 * inside the host's time limit; users not reached today go first tomorrow.
 */
export async function runDailyDigests({ budgetMs, now = new Date() }: { budgetMs: number; now?: Date }) {
  const started = Date.now();
  const profiles = await prisma.jobProfile.findMany({
    where: {
      dailyDigest: true,
      OR: [{ lastDigestAt: null }, { lastDigestAt: { lt: new Date(now.getTime() - 20 * 60 * 60 * 1000) } }],
    },
    orderBy: [{ lastDigestAt: { sort: "asc", nulls: "first" } }],
    include: { user: { select: { email: true, name: true } } },
    take: 25,
  });

  const results: DigestResult[] = [];
  for (const profile of profiles) {
    if (Date.now() - started > budgetMs) break;
    try {
      const summary = await runSearch(profile.userId, profile);
      const [newJobs, followUps] = await Promise.all([
        prisma.job.findMany({
          where: { id: { in: summary.newJobIds }, score: { gte: 60 } },
          orderBy: { score: "desc" },
          take: 8,
          select: { id: true, title: true, company: true, location: true, score: true },
        }),
        prisma.job.findMany({
          where: { userId: profile.userId, status: "SUBMITTED", followUpAt: { lte: new Date(now.getTime() + DAY_MS) } },
          orderBy: { followUpAt: "asc" },
          take: 10,
          select: { id: true, title: true, company: true, location: true, score: true },
        }),
      ]);

      let emailed = false;
      if ((newJobs.length || followUps.length) && emailConfigured()) {
        await sendDigestEmail(profile.user.email, profile.user.name, newJobs, followUps);
        emailed = true;
      }
      await prisma.jobProfile.update({ where: { id: profile.id }, data: { lastDigestAt: now, lastSearchAt: now } });
      results.push({ userId: profile.userId, newMatches: newJobs.length, followUpsDue: followUps.length, emailed });
    } catch (e) {
      results.push({ userId: profile.userId, newMatches: 0, followUpsDue: 0, emailed: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return { processed: results.length, waiting: profiles.length - results.length, results };
}
