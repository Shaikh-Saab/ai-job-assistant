import type { RawJob } from "@/lib/jobs/types";

export type ScoringProfile = {
  roleKeywords: string[];
  skills: string[];
  minSalaryUsd: number | null;
  wantsRelocation: boolean;
  entryLevelOnly: boolean;
  preferredLocations?: string[];
};

export type Scored = {
  score: number;
  signals: string[];
  relevant: boolean;
  senior: boolean;
  /** True when the user has preferred locations and this posting matches none of them. */
  outsidePreferredLocations: boolean;
};

/** Common alternate spellings so "UK" matches "London, United Kingdom", etc. */
const LOCATION_ALIASES: Record<string, string[]> = {
  uk: ["united kingdom", "england", "scotland", "wales", "london", "gb"],
  "united kingdom": ["uk", "england", "london"],
  us: ["united states", "usa", "u.s."],
  usa: ["united states", "us"],
  "united states": ["usa", "us"],
  uae: ["united arab emirates", "dubai", "abu dhabi"],
  germany: ["deutschland", "berlin", "munich", "münchen", "hamburg"],
  netherlands: ["amsterdam", "holland"],
  europe: ["eu", "emea"],
};

export function matchesLocation(job: Pick<RawJob, "location" | "remote">, prefs: string[]) {
  const loc = job.location.toLowerCase();
  return prefs.some((raw) => {
    const p = raw.trim().toLowerCase();
    if (!p) return false;
    if (p === "remote" || p === "anywhere") return job.remote || /remote|anywhere|worldwide/.test(loc);
    return [p, ...(LOCATION_ALIASES[p] ?? [])].some((alias) => wordRe(alias).test(loc));
  });
}

const ENTRY_TITLE = /\b(junior|jr\.?|graduate|grad|new[- ]grad|entry[- ]level|early[- ]career|associate|intern(ship)?|trainee|apprentice|fresher|campus|university|residen(t|cy)|fellow(ship)?|level\s?(i|1)\b|engineer\s?(i|1)\b)/i;
const ENTRY_TEXT = /\b(0\s?[-–]\s?2\+? years|0\s?[-–]\s?1 years?|1\+ years?|no (prior )?experience (required|needed)|recent graduates?|new graduates?|graduating|early in your career|entry[- ]level)\b/i;
const SENIOR_TITLE = /\b(senior|sr\.?|staff|principal|lead|head of|manager|director|vp|vice president|chief|architect|distinguished|expert)\b/i;
const SENIOR_TEXT = /\b([5-9]|1[0-9])\+?\s?(years|yrs)\b/i;
const LOW_CODE = /\b(low[- ]code|no[- ]code|prompt(ing)? engineer(ing)?|prompt design|copilot studio|power (platform|automate|apps)|zapier|n8n|make\.com|workflow automation|ai automation|solutions engineer|forward[- ]deployed|ai operations|ai trainer|data annotation)\b/i;
const RELOCATION = /\b(relocation (support|package|assistance|bonus)?|relocate|visa sponsorship|sponsor(ship)? (a |your )?(work )?visa|visa support|we sponsor)\b/i;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Whole-word, case-insensitive match; "AI" must not match "maintain". */
const wordRe = (k: string) => new RegExp(`(^|[^a-z0-9])${escape(k.toLowerCase())}($|[^a-z0-9])`, "i");

/**
 * Heuristic fit score, 0–100, computed for free on every posting. Claude does a deeper,
 * resume-aware fit analysis only for jobs the user opens (see lib/jobs/ai.ts).
 */
export function scoreJob(job: RawJob, p: ScoringProfile, now = new Date()): Scored {
  const title = job.title;
  const text = `${job.title}\n${job.description}`;
  const signals: string[] = [];
  let score = 20;

  // Relevance: role keywords in the title count far more than in the body.
  const titleHits = p.roleKeywords.filter((k) => wordRe(k).test(title));
  const bodyHits = p.roleKeywords.filter((k) => !titleHits.includes(k) && wordRe(k).test(job.description));
  const aiInTitle = /\b(ai|a\.i\.|ml)\b/i.test(title);
  if (titleHits.length || aiInTitle) {
    score += 30 + Math.min(10, titleHits.length * 4);
    signals.push(`AI role: ${(titleHits[0] ?? "AI").toString()}`);
  } else if (bodyHits.length >= 2) {
    score += 12;
    signals.push(`Uses ${bodyHits.slice(0, 2).join(", ")}`);
  }
  const relevant = titleHits.length > 0 || aiInTitle || bodyHits.length >= 2;

  // Seniority
  const senior = SENIOR_TITLE.test(title);
  if (ENTRY_TITLE.test(title)) {
    score += 22;
    signals.push("Entry-level title");
  } else if (ENTRY_TEXT.test(job.description)) {
    score += 12;
    signals.push("Open to new grads");
  }
  if (senior) score -= 35;
  else if (SENIOR_TEXT.test(job.description) && !ENTRY_TEXT.test(job.description)) {
    score -= 12;
    signals.push("Asks for 5+ years");
  }

  // Low-code / GenAI-tool work
  if (LOW_CODE.test(text)) {
    score += 8;
    signals.push("GenAI / low-code tools");
  }

  // Skills overlap
  const skillHits = p.skills.filter((s) => wordRe(s).test(text));
  if (skillHits.length) {
    score += Math.min(12, skillHits.length * 3);
    signals.push(`Skills: ${skillHits.slice(0, 3).join(", ")}`);
  }

  // Relocation / visa
  if (RELOCATION.test(job.description)) {
    score += p.wantsRelocation ? 10 : 3;
    signals.push("Relocation or visa support");
  } else if (job.remote) {
    score += 4;
    signals.push("Remote");
  }

  // Pay
  if (job.salaryMinUsd) {
    if (p.minSalaryUsd && job.salaryMinUsd >= p.minSalaryUsd) {
      score += 8;
      signals.push(`Pay ≥ your minimum`);
    } else if (p.minSalaryUsd && job.salaryMinUsd < p.minSalaryUsd * 0.8) {
      score -= 10;
      signals.push("Pay below your minimum");
    } else {
      score += 2;
    }
  }

  // Location preferences
  const prefs = (p.preferredLocations ?? []).filter((x) => x.trim());
  let outsidePreferredLocations = false;
  if (prefs.length) {
    if (matchesLocation(job, prefs)) {
      score += 10;
      signals.push("In your preferred locations");
    } else {
      outsidePreferredLocations = true;
      score -= 6;
    }
  }

  // Freshness
  const ageDays = (now.getTime() - job.postedAt.getTime()) / 86_400_000;
  if (ageDays <= 2) {
    score += 4;
    signals.push("Posted in the last 2 days");
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), signals, relevant, senior, outsidePreferredLocations };
}
