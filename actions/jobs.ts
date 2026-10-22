"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { currentUser, currentUserId } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateJobProfile } from "@/lib/data/jobs";
import { AIError, AI_MODEL, AI_UNAVAILABLE, aiAllowedFor, draftApplication, parseResume } from "@/lib/jobs/ai";
import { scoreJob } from "@/lib/jobs/score";
import { runSearch } from "@/lib/jobs/sync";
import type { SearchSummary } from "@/lib/jobs/types";
import {
  JOB_STATUSES,
  SUBMIT_CHECKLIST,
  jobProfileSchema,
  locationPrefsSchema,
  manualJobSchema,
  packetSchema,
  type ChecklistKey,
  type JobStatusValue,
} from "@/lib/validations";
import type { ActionResult } from "@/types/actions";

const UNAUTHORIZED = { ok: false, error: "You must be signed in" } as const;
const invalid = (e: { flatten: () => { fieldErrors: Record<string, string[] | undefined> } }) =>
  ({ ok: false, error: "Some fields need attention", fieldErrors: e.flatten().fieldErrors }) as const;

const aiError = (e: unknown) => ({
  ok: false as const,
  error: e instanceof AIError ? e.message : "Something went wrong talking to Claude. Try again.",
});

// ---------- Search profile ----------

export async function saveJobProfile(input: unknown): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return UNAUTHORIZED;
  const parsed = jobProfileSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  await getOrCreateJobProfile(userId);
  await prisma.jobProfile.update({ where: { userId }, data: parsed.data });
  revalidatePath("/jobs");
  return { ok: true, message: "Search profile saved" };
}

export async function saveLocationPreferences(input: unknown): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return UNAUTHORIZED;
  const parsed = locationPrefsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  await getOrCreateJobProfile(userId);
  await prisma.jobProfile.update({ where: { userId }, data: parsed.data });
  revalidatePath("/jobs");
  revalidatePath("/settings");
  return { ok: true, message: "Location preferences saved. They apply from your next search." };
}

/** Claude reads the pasted resume and suggests headline, skills and role keywords. */
export async function suggestProfileFromResume(
  resumeText: string,
): Promise<ActionResult<{ headline: string; skills: string[]; roleKeywords: string[] }>> {
  const user = await currentUser();
  if (!user) return UNAUTHORIZED;
  if (!aiAllowedFor(user.email)) return { ok: false, error: AI_UNAVAILABLE };
  const text = String(resumeText ?? "").trim();
  if (text.length < 200) return { ok: false, error: "Paste your full resume first (at least a few paragraphs)." };
  if (text.length > 30_000) return { ok: false, error: "Resume is too long (30,000 characters max)." };

  try {
    const draft = await parseResume(text);
    return {
      ok: true,
      data: { headline: draft.headline.slice(0, 160), skills: draft.skills.slice(0, 15), roleKeywords: draft.roleKeywords.slice(0, 15) },
      message: "Suggestions ready. Review them, then save.",
    };
  } catch (e) {
    return aiError(e);
  }
}

// ---------- Search ----------

const SEARCH_COOLDOWN_MS = 10 * 60_000;

export async function searchJobs(): Promise<ActionResult<SearchSummary>> {
  const userId = await currentUserId();
  if (!userId) return UNAUTHORIZED;
  const profile = await getOrCreateJobProfile(userId);

  // One search per user per 10 minutes keeps us polite to the free job APIs.
  const since = profile.lastSearchAt ? Date.now() - profile.lastSearchAt.getTime() : Infinity;
  if (since < SEARCH_COOLDOWN_MS) {
    const mins = Math.ceil((SEARCH_COOLDOWN_MS - since) / 60_000);
    return { ok: false, error: `You searched recently. Try again in ${mins} minute${mins === 1 ? "" : "s"}.` };
  }
  await prisma.jobProfile.update({ where: { userId }, data: { lastSearchAt: new Date() } });

  const summary = await runSearch(userId, profile);
  revalidatePath("/jobs");
  return {
    ok: true,
    data: summary,
    message: `Found ${summary.matched} matching roles (${summary.added} new) from ${summary.scanned.toLocaleString()} postings this week`,
  };
}

/** For LinkedIn or any other site: the user pastes the link and details. Nothing is fetched from it. */
export async function addManualJob(input: unknown): Promise<ActionResult<{ id: string }>> {
  const userId = await currentUserId();
  if (!userId) return UNAUTHORIZED;
  const parsed = manualJobSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const d = parsed.data;

  const profile = await getOrCreateJobProfile(userId);
  const raw = {
    source: "MANUAL" as const,
    externalId: createHash("sha256").update(d.url).digest("hex").slice(0, 32),
    company: d.company, title: d.title, location: d.location || "", remote: /remote/i.test(d.location ?? ""),
    url: d.url, description: d.description || "", postedAt: new Date(),
  };
  const { score, signals } = scoreJob(raw, profile);

  const job = await prisma.job.upsert({
    where: { userId_source_externalId: { userId, source: "MANUAL", externalId: raw.externalId } },
    create: { userId, ...raw, score, signals, status: "SHORTLISTED" },
    update: { title: raw.title, company: raw.company, location: raw.location, description: raw.description, score, signals },
    select: { id: true },
  });
  revalidatePath("/jobs");
  return { ok: true, data: job, message: "Job added to your shortlist" };
}

// ---------- Status ----------

export async function setJobStatus(id: string, status: JobStatusValue): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return UNAUTHORIZED;
  if (!(JOB_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Unknown status" };
  if (status === "SUBMITTED") return { ok: false, error: "Use “I submitted it” on the job page so the checklist is enforced." };

  const { count } = await prisma.job.updateMany({ where: { id, userId }, data: { status } });
  if (!count) return { ok: false, error: "Job not found" };
  revalidatePath("/jobs");
  revalidatePath(`/jobs/${id}`);
  return { ok: true, message: "Status updated" };
}

export async function saveJobNotes(id: string, notes: string): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return UNAUTHORIZED;
  const { count } = await prisma.job.updateMany({ where: { id, userId }, data: { notes: String(notes).slice(0, 10_000) } });
  return count ? { ok: true, message: "Notes saved" } : { ok: false, error: "Job not found" };
}

// ---------- Application packet ----------

async function ownedJob(userId: string, id: string) {
  return prisma.job.findFirst({ where: { id, userId }, include: { packet: true } });
}

/** Claude: fit analysis + tailored summary, cover letter and screening answers for one job. */
export async function generatePacket(jobId: string): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return UNAUTHORIZED;
  if (!aiAllowedFor(user.email)) return { ok: false, error: AI_UNAVAILABLE };
  const userId = user.id;

  const [job, profile] = await Promise.all([ownedJob(userId, jobId), getOrCreateJobProfile(userId)]);
  if (!job) return { ok: false, error: "Job not found" };
  if (profile.resumeText.trim().length < 200) {
    return { ok: false, error: "Add your resume in Job profile first. Claude only writes from facts in it." };
  }

  try {
    const d = await draftApplication(job, profile);
    const data = {
      fitScore: d.fitScore, fitSummary: d.fitSummary, strengths: d.strengths, gaps: d.gaps,
      summary: d.summary, coverLetter: d.coverLetter, answers: d.answers as Prisma.InputJsonValue,
      checks: d.checks, model: AI_MODEL, generatedAt: new Date(),
    };
    await prisma.$transaction([
      prisma.applicationPacket.upsert({ where: { jobId }, create: { jobId, ...data }, update: data }),
      // Drafting moves a fresh job forward, but never pulls back a later status.
      prisma.job.updateMany({ where: { id: jobId, userId, status: { in: ["NEW", "SHORTLISTED"] } }, data: { status: "PREPARED" } }),
    ]);
    revalidatePath(`/jobs/${jobId}`);
    revalidatePath("/jobs");
    return { ok: true, message: "Draft ready. Review every line before you use it." };
  } catch (e) {
    return aiError(e);
  }
}

export async function savePacket(jobId: string, input: unknown): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return UNAUTHORIZED;
  const parsed = packetSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (!(await ownedJob(userId, jobId))) return { ok: false, error: "Job not found" };

  const data = { ...parsed.data, answers: parsed.data.answers as Prisma.InputJsonValue };
  await prisma.applicationPacket.upsert({ where: { jobId }, create: { jobId, ...data }, update: data });
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true, message: "Packet saved" };
}

export async function setChecklistItem(jobId: string, key: ChecklistKey, value: boolean): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return UNAUTHORIZED;
  if (!SUBMIT_CHECKLIST.some((c) => c.key === key)) return { ok: false, error: "Unknown checklist item" };
  const job = await ownedJob(userId, jobId);
  if (!job) return { ok: false, error: "Job not found" };

  const checklist = { ...((job.packet?.checklist as Record<string, boolean> | null) ?? {}), [key]: !!value };
  await prisma.applicationPacket.upsert({ where: { jobId }, create: { jobId, checklist }, update: { checklist } });
  return { ok: true };
}

/**
 * The user submitted on the employer's site and confirms it here. Refused unless every
 * checklist item is ticked, so nothing is logged as sent without the double-check.
 */
export async function markSubmitted(jobId: string): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return UNAUTHORIZED;
  const job = await ownedJob(userId, jobId);
  if (!job) return { ok: false, error: "Job not found" };

  const checklist = (job.packet?.checklist as Record<string, boolean> | null) ?? {};
  const missing = SUBMIT_CHECKLIST.filter((c) => !checklist[c.key]);
  if (missing.length) return { ok: false, error: `Tick every checklist item first (${missing.length} left).` };

  await prisma.job.update({ where: { id: jobId }, data: { status: "SUBMITTED", submittedAt: new Date() } });
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  return { ok: true, message: "Marked as submitted. Good luck!" };
}
