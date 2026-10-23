"use server";

import { createHash } from "crypto";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { currentUser, currentUserId } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateJobProfile } from "@/lib/data/jobs";
import {
  AIError, AI_MODEL, aiAllowedFor, aiBlockedReason, draftApplication, generateInterviewPrep, parseResume,
} from "@/lib/jobs/ai";
import { logJobEvent } from "@/lib/jobs/events";
import { extractPdfText, RESUME_PDF_MAX_BYTES } from "@/lib/jobs/resume";
import { scoreJob } from "@/lib/jobs/score";
import { runSearch } from "@/lib/jobs/sync";
import type { SearchSummary } from "@/lib/jobs/types";
import {
  JOB_STATUSES,
  JOB_STATUS_LABELS,
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

/** Extract plain text from an uploaded resume PDF. Free for everyone (no AI involved). */
export async function extractResumeFromPdf(formData: FormData): Promise<ActionResult<{ text: string; pages: number }>> {
  const userId = await currentUserId();
  if (!userId) return UNAUTHORIZED;
  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a PDF file" };
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return { ok: false, error: "Upload a PDF (.pdf)" };
  if (file.size > RESUME_PDF_MAX_BYTES) return { ok: false, error: "PDF must be 5 MB or smaller" };

  try {
    const { text, pages } = await extractPdfText(new Uint8Array(await file.arrayBuffer()));
    if (text.length < 100) {
      return { ok: false, error: "That PDF has almost no selectable text (it may be a scanned image). Paste your resume as text instead." };
    }
    return { ok: true, data: { text: text.slice(0, 30_000), pages }, message: `Read ${pages} page${pages === 1 ? "" : "s"}. Review the text, then save.` };
  } catch {
    return { ok: false, error: "Couldn’t read that PDF. Try exporting it again, or paste the text." };
  }
}

/** Claude reads the pasted resume and suggests headline, skills and role keywords. */
export async function suggestProfileFromResume(
  resumeText: string,
): Promise<ActionResult<{ headline: string; skills: string[]; roleKeywords: string[] }>> {
  const user = await currentUser();
  if (!user) return UNAUTHORIZED;
  if (!aiAllowedFor(user.email)) return { ok: false, error: `${aiBlockedReason(user.email)} You can still write it by hand.` };
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
  await logJobEvent(prisma, job.id, "FOUND", "Added by link");
  revalidatePath("/jobs");
  return { ok: true, data: job, message: "Job added to your shortlist" };
}

// ---------- Status ----------

export async function setJobStatus(id: string, status: JobStatusValue): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return UNAUTHORIZED;
  if (!(JOB_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "Unknown status" };
  if (status === "SUBMITTED") return { ok: false, error: "Use “I submitted it” on the job page so the checklist is enforced." };

  const { count } = await prisma.job.updateMany({
    where: { id, userId },
    // Interviews/offers/rejections answer the follow-up; clear it.
    data: { status, ...(["INTERVIEW", "OFFER", "REJECTED", "SKIPPED"].includes(status) && { followUpAt: null }) },
  });
  if (!count) return { ok: false, error: "Job not found" };
  await logJobEvent(prisma, id, "STATUS", JOB_STATUS_LABELS[status]);
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
  if (!aiAllowedFor(user.email)) return { ok: false, error: `${aiBlockedReason(user.email)} You can still write it by hand.` };
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
      logJobEvent(prisma, jobId, "DRAFTED", `Claude fit ${d.fitScore}/100`),
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
  await logJobEvent(prisma, jobId, "PACKET_SAVED");
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

  const followUpAt = new Date(Date.now() + FOLLOW_UP_DAYS * 86_400_000);
  await prisma.$transaction([
    prisma.job.update({ where: { id: jobId }, data: { status: "SUBMITTED", submittedAt: new Date(), followUpAt } }),
    logJobEvent(prisma, jobId, "SUBMITTED"),
    logJobEvent(prisma, jobId, "FOLLOW_UP_SET", `Follow up on ${followUpAt.toDateString()}`),
  ]);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  return { ok: true, message: `Marked as submitted. We’ll remind you to follow up in ${FOLLOW_UP_DAYS} days.` };
}

// ---------- Follow-ups ----------

const FOLLOW_UP_DAYS = 7;

/** Set (ISO date "YYYY-MM-DD") or clear (null) the follow-up reminder for a job. */
export async function setFollowUp(jobId: string, date: string | null): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return UNAUTHORIZED;
  let followUpAt: Date | null = null;
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "Pick a valid date" };
    followUpAt = new Date(`${date}T09:00:00.000Z`);
  }
  const { count } = await prisma.job.updateMany({ where: { id: jobId, userId }, data: { followUpAt } });
  if (!count) return { ok: false, error: "Job not found" };
  if (followUpAt) await logJobEvent(prisma, jobId, "FOLLOW_UP_SET", `Follow up on ${followUpAt.toDateString()}`);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  return { ok: true, message: followUpAt ? "Follow-up scheduled" : "Follow-up cleared" };
}

/** The user chased the employer; log it and remind again in a week. */
export async function markFollowedUp(jobId: string): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return UNAUTHORIZED;
  const next = new Date(Date.now() + FOLLOW_UP_DAYS * 86_400_000);
  const { count } = await prisma.job.updateMany({ where: { id: jobId, userId }, data: { followUpAt: next } });
  if (!count) return { ok: false, error: "Job not found" };
  await logJobEvent(prisma, jobId, "FOLLOWED_UP", `Next reminder ${next.toDateString()}`);
  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/jobs");
  return { ok: true, message: "Logged. Next reminder in a week." };
}

// ---------- Interview prep (Claude, owner only) ----------

export async function prepareInterview(jobId: string): Promise<ActionResult> {
  const user = await currentUser();
  if (!user) return UNAUTHORIZED;
  if (!aiAllowedFor(user.email)) return { ok: false, error: `${aiBlockedReason(user.email)} You can still write it by hand.` };
  const [job, profile] = await Promise.all([ownedJob(user.id, jobId), getOrCreateJobProfile(user.id)]);
  if (!job) return { ok: false, error: "Job not found" };
  if (profile.resumeText.trim().length < 200) return { ok: false, error: "Add your resume in Job profile first." };

  try {
    const prep = await generateInterviewPrep(job, profile);
    await prisma.$transaction([
      prisma.applicationPacket.upsert({
        where: { jobId },
        create: { jobId, interviewPrep: prep as Prisma.InputJsonValue },
        update: { interviewPrep: prep as Prisma.InputJsonValue },
      }),
      logJobEvent(prisma, jobId, "INTERVIEW_PREP"),
    ]);
    revalidatePath(`/jobs/${jobId}`);
    return { ok: true, message: "Interview prep ready" };
  } catch (e) {
    return aiError(e);
  }
}

// ---------- Daily digest ----------

export async function setDailyDigest(enabled: boolean): Promise<ActionResult> {
  const userId = await currentUserId();
  if (!userId) return UNAUTHORIZED;
  await getOrCreateJobProfile(userId);
  await prisma.jobProfile.update({ where: { userId }, data: { dailyDigest: !!enabled } });
  revalidatePath("/jobs");
  revalidatePath("/jobs/profile");
  return { ok: true, message: enabled ? "Daily digest on. You’ll get an email each morning with new matches." : "Daily digest off" };
}
