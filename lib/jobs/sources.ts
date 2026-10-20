import "server-only";
import type { RawJob, SourceReport } from "@/lib/jobs/types";
import { ADZUNA_CURRENCY, clip, htmlToText, parseSalaryText, toUsd } from "@/lib/jobs/text";

/*
 * Each fetcher uses a public, documented job-board API that allows programmatic access.
 * LinkedIn is deliberately absent: its terms prohibit automated access, so LinkedIn postings
 * are only added by the user pasting a link (see addManualJob).
 */

const COMPANY_NAMES: Record<string, string> = {
  openai: "OpenAI", elevenlabs: "ElevenLabs", langchain: "LangChain", shieldai: "Shield AI",
  deepgram: "Deepgram", scaleai: "Scale AI", gitlab: "GitLab", mongodb: "MongoDB",
};
/** Ashby and Lever return only the board slug; turn "openai" into "OpenAI". */
export const companyName = (slug: string) =>
  COMPANY_NAMES[slug.toLowerCase()] ?? slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const HEADERS = { "User-Agent": "Nexus job tracker (personal use)", Accept: "application/json" };

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(25_000), cache: "no-store" });
  if (!res.ok) throw new Error(res.status === 404 ? "Board not found (check the name)" : `HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

type Fetched = { jobs: RawJob[]; report: SourceReport };

const ok = (source: RawJob["source"], label: string, jobs: RawJob[]): Fetched => ({
  jobs,
  report: { source, label, fetched: jobs.length },
});
const fail = (source: RawJob["source"], label: string, e: unknown): Fetched => ({
  jobs: [],
  report: { source, label, fetched: 0, error: e instanceof Error ? e.message : String(e) },
});

// ---------- Greenhouse: boards-api.greenhouse.io ----------

type GHJob = {
  id: number; title: string; absolute_url: string; company_name?: string;
  location?: { name?: string }; first_published?: string; updated_at: string; content?: string;
};

export async function greenhouse(board: string, since: Date): Promise<Fetched> {
  try {
    const { jobs } = await getJSON<{ jobs: GHJob[] }>(
      `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs?content=true`,
    );
    const out = jobs
      .map((j): RawJob => {
        const location = j.location?.name ?? "";
        const description = clip(htmlToText(j.content));
        return {
          source: "GREENHOUSE", externalId: String(j.id), company: j.company_name ?? board,
          title: j.title.trim(), location, remote: /remote/i.test(location), url: j.absolute_url,
          description, salaryText: null, salaryMinUsd: parseSalaryText(description.match(/(?:\$|£|€)[\d,.]+\s?[kK]?\s?[-–—]\s?(?:\$|£|€)?[\d,.]+\s?[kK]?/)?.[0]),
          postedAt: new Date(j.first_published ?? j.updated_at),
        };
      })
      .filter((j) => j.postedAt >= since);
    return ok("GREENHOUSE", board, out);
  } catch (e) {
    return fail("GREENHOUSE", board, e);
  }
}

// ---------- Lever: api.lever.co ----------

type LeverJob = {
  id: string; text: string; hostedUrl: string; createdAt: number; descriptionPlain?: string;
  additionalPlain?: string; workplaceType?: string; categories?: { location?: string; commitment?: string };
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
};

export async function lever(board: string, since: Date): Promise<Fetched> {
  try {
    const jobs = await getJSON<LeverJob[]>(`https://api.lever.co/v0/postings/${encodeURIComponent(board)}?mode=json`);
    const out = jobs
      .filter((j) => j.createdAt >= since.getTime())
      .map((j): RawJob => {
        const sr = j.salaryRange;
        const annual = sr?.interval?.includes("year") || !sr?.interval;
        return {
          source: "LEVER", externalId: j.id, company: companyName(board), title: j.text.trim(),
          location: j.categories?.location ?? "", remote: j.workplaceType === "remote",
          url: j.hostedUrl, description: clip([j.descriptionPlain, j.additionalPlain].filter(Boolean).join("\n\n")),
          salaryText: sr?.min ? `${sr.currency ?? ""} ${sr.min.toLocaleString()}–${(sr.max ?? sr.min).toLocaleString()}`.trim() : null,
          salaryMinUsd: sr?.min && annual ? toUsd(sr.min, sr.currency ?? "USD") : null,
          postedAt: new Date(j.createdAt),
        };
      });
    return ok("LEVER", board, out);
  } catch (e) {
    return fail("LEVER", board, e);
  }
}

// ---------- Ashby: api.ashbyhq.com/posting-api ----------

type AshbyJob = {
  id: string; title: string; location?: string; isRemote?: boolean; isListed?: boolean;
  jobUrl: string; applyUrl?: string; publishedAt: string; descriptionPlain?: string;
  compensation?: { compensationTierSummary?: string };
};

export async function ashby(board: string, since: Date): Promise<Fetched> {
  try {
    const { jobs } = await getJSON<{ jobs: AshbyJob[] }>(
      `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(board)}?includeCompensation=true`,
    );
    const out = jobs
      .filter((j) => j.isListed !== false && new Date(j.publishedAt) >= since)
      .map((j): RawJob => {
        const comp = j.compensation?.compensationTierSummary ?? null;
        return {
          source: "ASHBY", externalId: j.id, company: companyName(board), title: j.title.trim(),
          location: j.location ?? "", remote: !!j.isRemote, url: j.jobUrl,
          description: clip(j.descriptionPlain ?? ""), salaryText: comp, salaryMinUsd: parseSalaryText(comp),
          postedAt: new Date(j.publishedAt),
        };
      });
    return ok("ASHBY", board, out);
  } catch (e) {
    return fail("ASHBY", board, e);
  }
}

// ---------- Adzuna: api.adzuna.com (free key required) ----------

type AdzunaJob = {
  id: string; title: string; redirect_url: string; description: string; created: string;
  company?: { display_name?: string }; location?: { display_name?: string };
  salary_min?: number; salary_max?: number; salary_is_predicted?: string;
};

export async function adzuna(country: string, keywords: string[], appId: string, appKey: string): Promise<Fetched> {
  const label = country.toUpperCase();
  try {
    const params = new URLSearchParams({
      app_id: appId, app_key: appKey, results_per_page: "50", max_days_old: "7",
      what_or: keywords.join(" "), sort_by: "date", "content-type": "application/json",
    });
    const pages = await Promise.all(
      [1, 2].map((p) =>
        getJSON<{ results: AdzunaJob[] }>(`https://api.adzuna.com/v1/api/jobs/${country}/search/${p}?${params}`),
      ),
    );
    const currency = ADZUNA_CURRENCY[country] ?? "USD";
    const out = pages.flatMap((pg) => pg.results).map((j): RawJob => {
      const predicted = j.salary_is_predicted === "1";
      return {
        source: "ADZUNA", externalId: `${country}-${j.id}`, company: j.company?.display_name ?? "Unknown company",
        title: htmlToText(j.title), location: j.location?.display_name ?? label,
        remote: /remote/i.test(`${j.title} ${j.description}`), url: j.redirect_url,
        // Adzuna returns a snippet; the full posting is on the employer site behind redirect_url.
        description: htmlToText(j.description),
        salaryText: j.salary_min && !predicted ? `${currency} ${Math.round(j.salary_min).toLocaleString()}–${Math.round(j.salary_max ?? j.salary_min).toLocaleString()}` : null,
        salaryMinUsd: !predicted ? toUsd(j.salary_min, currency) : null,
        postedAt: new Date(j.created),
      };
    });
    return ok("ADZUNA", label, out);
  } catch (e) {
    return fail("ADZUNA", label, e);
  }
}

// ---------- Remotive: remotive.com/api (remote roles worldwide) ----------

type RemotiveJob = {
  id: number; url: string; title: string; company_name: string; publication_date: string;
  candidate_required_location: string; salary?: string; description: string;
};

export async function remotive(searchTerms: string[], since: Date): Promise<Fetched> {
  try {
    const results = await Promise.all(
      searchTerms.map((t) =>
        getJSON<{ jobs: RemotiveJob[] }>(`https://remotive.com/api/remote-jobs?search=${encodeURIComponent(t)}&limit=100`),
      ),
    );
    const seen = new Set<number>();
    const out = results
      .flatMap((r) => r.jobs)
      .filter((j) => !seen.has(j.id) && seen.add(j.id) && new Date(`${j.publication_date}Z`) >= since)
      .map((j): RawJob => ({
        source: "REMOTIVE", externalId: String(j.id), company: j.company_name, title: j.title.trim(),
        location: `Remote · ${j.candidate_required_location}`, remote: true, url: j.url,
        description: clip(htmlToText(j.description)), salaryText: j.salary || null,
        salaryMinUsd: parseSalaryText(j.salary), postedAt: new Date(`${j.publication_date}Z`),
      }));
    return ok("REMOTIVE", "Remote roles", out);
  } catch (e) {
    return fail("REMOTIVE", "Remote roles", e);
  }
}

// ---------- Arbeitnow: arbeitnow.com/api (Europe, many with relocation/visa) ----------

type ArbeitnowJob = {
  slug: string; company_name: string; title: string; description: string; remote: boolean;
  url: string; location: string; created_at: number; tags?: string[]; visa_sponsorship?: boolean;
};

export async function arbeitnow(since: Date): Promise<Fetched> {
  try {
    const pages = await Promise.all(
      [1, 2, 3].map((p) => getJSON<{ data: ArbeitnowJob[] }>(`https://www.arbeitnow.com/api/job-board-api?page=${p}`)),
    );
    const out = pages
      .flatMap((p) => p.data)
      .filter((j) => j.created_at * 1000 >= since.getTime())
      .map((j): RawJob => ({
        source: "ARBEITNOW", externalId: j.slug, company: j.company_name, title: j.title.trim(),
        location: j.location, remote: j.remote, url: j.url,
        description: clip(htmlToText(j.description) + (j.visa_sponsorship ? "\n\nVisa sponsorship available." : "")),
        salaryText: null, salaryMinUsd: null, postedAt: new Date(j.created_at * 1000),
      }));
    return ok("ARBEITNOW", "Europe (Arbeitnow)", out);
  } catch (e) {
    return fail("ARBEITNOW", "Europe (Arbeitnow)", e);
  }
}

// ---------- Himalayas: himalayas.app/jobs/api (remote, worldwide, has seniority) ----------

type HimalayasJob = {
  guid: string; title: string; companyName: string; description: string; applicationLink: string;
  pubDate: string | number; minSalary?: string | number | null; maxSalary?: string | number | null;
  currency?: string | null; salaryPeriod?: string | null; seniority?: string[]; locationRestrictions?: string[];
};

export async function himalayas(searchTerms: string[], since: Date): Promise<Fetched> {
  try {
    const results = await Promise.all(
      searchTerms.map((t) =>
        getJSON<{ jobs: HimalayasJob[] }>(`https://himalayas.app/jobs/api/search?q=${encodeURIComponent(t)}&sort=recent`),
      ),
    );
    const seen = new Set<string>();
    const out = results
      .flatMap((r) => r.jobs ?? [])
      .filter((j) => !seen.has(j.guid) && seen.add(j.guid))
      .map((j): RawJob => {
        const min = Number(j.minSalary) || null;
        const cur = j.currency ?? "USD";
        const where = j.locationRestrictions?.length ? j.locationRestrictions.join(", ") : "Worldwide";
        return {
          source: "HIMALAYAS", externalId: j.guid, company: j.companyName, title: j.title.trim(),
          location: `Remote · ${where}`, remote: true, url: j.applicationLink || j.guid,
          description: clip(
            htmlToText(j.description) + (j.seniority?.length ? `\n\nSeniority: ${j.seniority.join(", ")}` : ""),
          ),
          salaryText: min ? `${cur} ${min.toLocaleString()}–${(Number(j.maxSalary) || min).toLocaleString()}` : null,
          salaryMinUsd: min && (j.salaryPeriod ?? "annual") === "annual" ? toUsd(min, cur) : null,
          postedAt: new Date(Number(j.pubDate) * 1000),
        };
      })
      .filter((j) => j.postedAt >= since);
    return ok("HIMALAYAS", "Remote (Himalayas)", out);
  } catch (e) {
    return fail("HIMALAYAS", "Remote (Himalayas)", e);
  }
}

// ---------- Jobicy: jobicy.com/api/v2 (remote; feed terms ask for a credit link to Jobicy) ----------

type JobicyJob = {
  id: number | string; url: string; jobTitle: string; companyName: string; jobGeo?: string; jobLevel?: string;
  jobDescription?: string; pubDate: string; annualSalaryMin?: number; annualSalaryMax?: number; salaryCurrency?: string;
};

export async function jobicy(tags: string[], since: Date): Promise<Fetched> {
  try {
    const results = await Promise.all(
      tags.map((t) => getJSON<{ jobs?: JobicyJob[] }>(`https://jobicy.com/api/v2/remote-jobs?count=50&tag=${encodeURIComponent(t)}`)),
    );
    const seen = new Set<string>();
    const out = results
      .flatMap((r) => r.jobs ?? [])
      .filter((j) => !seen.has(String(j.id)) && seen.add(String(j.id)) && new Date(j.pubDate) >= since)
      .map((j): RawJob => {
        const cur = j.salaryCurrency ?? "USD";
        return {
          source: "JOBICY", externalId: String(j.id), company: j.companyName, title: htmlToText(j.jobTitle),
          location: `Remote · ${j.jobGeo ?? "Anywhere"}`, remote: true, url: j.url,
          description: clip(htmlToText(j.jobDescription) + (j.jobLevel ? `\n\nLevel: ${j.jobLevel}` : "")),
          salaryText: j.annualSalaryMin ? `${cur} ${j.annualSalaryMin.toLocaleString()}–${(j.annualSalaryMax ?? j.annualSalaryMin).toLocaleString()}` : null,
          salaryMinUsd: toUsd(j.annualSalaryMin, cur),
          postedAt: new Date(j.pubDate),
        };
      });
    return ok("JOBICY", "Remote (Jobicy)", out);
  } catch (e) {
    return fail("JOBICY", "Remote (Jobicy)", e);
  }
}

/** Run async tasks with a concurrency cap (keeps us polite to the board APIs). */
export async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}
