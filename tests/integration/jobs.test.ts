import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ user: null as { id: string; email: string } | null }));
vi.mock("@/auth", () => ({
  currentUserId: async () => state.user?.id ?? null,
  currentUser: async () => state.user,
  auth: async () => (state.user ? { user: state.user } : null),
  signIn: vi.fn(),
  signOut: vi.fn(),
  unstable_update: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// The daily digest test must not hit ~50 live job APIs; it gets a canned search result.
const search = vi.hoisted(() => ({ newJobIds: [] as string[] }));
vi.mock("@/lib/jobs/sync", () => ({
  runSearch: vi.fn(async () => ({ reports: [], scanned: 0, matched: 0, added: 0, updated: 0, skippedSources: [], newJobIds: search.newJobIds })),
}));
const mail = vi.hoisted(() => ({ sendMail: vi.fn().mockResolvedValue({}) }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail: mail.sendMail }) } }));

import {
  addManualJob, extractResumeFromPdf, generatePacket, markFollowedUp, markSubmitted, prepareInterview,
  saveLocationPreferences, savePacket, searchJobs, setChecklistItem, setFollowUp, setJobStatus, suggestProfileFromResume,
} from "@/actions/jobs";
import { getOrCreateJobProfile, jobInsights, listJobs } from "@/lib/data/jobs";
import { runDailyDigests } from "@/lib/jobs/digest";
import { jobQuerySchema, SUBMIT_CHECKLIST } from "@/lib/validations";
import { cleanup, makeUser, prisma } from "../support/db";

let alice: { id: string; email: string };
let bob: { id: string; email: string };

const manual = (n: number) => ({
  url: `https://www.linkedin.com/jobs/view/${n}`,
  title: "Junior AI Engineer",
  company: `Acme ${n}`,
  location: "London, UK",
  description: "Build LLM features in Python. Visa sponsorship available. Recent graduates welcome.",
});
const add = async (n: number) => ((await addManualJob(manual(n))) as { data: { id: string } }).data.id;
const events = (jobId: string) => prisma.jobEvent.findMany({ where: { jobId }, orderBy: { createdAt: "asc" } });

beforeAll(async () => {
  await cleanup();
  alice = await makeUser("alice");
  bob = await makeUser("bob");
});
afterAll(cleanup);
beforeEach(() => {
  state.user = alice;
});

describe("adding and tracking jobs", () => {
  it("adds a pasted job to the shortlist, scored, with a 'Found' history entry", async () => {
    const id = await add(1);
    const job = await prisma.job.findUniqueOrThrow({ where: { id } });
    expect(job).toMatchObject({ source: "MANUAL", status: "SHORTLISTED", company: "Acme 1" });
    expect(job.score).toBeGreaterThan(60);
    expect((await events(id)).map((e) => e.type)).toEqual(["FOUND"]);
  });

  it("doesn't duplicate the same link", async () => {
    const a = await add(2);
    const b = await add(2);
    expect(a).toBe(b);
  });

  it("logs status changes and refuses 'Submitted' outside the checklist", async () => {
    const id = await add(3);
    expect((await setJobStatus(id, "SKIPPED")).ok).toBe(true);
    expect((await events(id)).at(-1)).toMatchObject({ type: "STATUS", detail: "Skipped" });
    expect(await setJobStatus(id, "SUBMITTED")).toMatchObject({ ok: false });
  });

  it("keeps each user's jobs private", async () => {
    const id = await add(4);
    state.user = bob;
    expect(await setJobStatus(id, "SKIPPED")).toMatchObject({ ok: false, error: "Job not found" });
    expect(await markSubmitted(id)).toMatchObject({ ok: false, error: "Job not found" });
    expect(await listJobs(bob.id, jobQuerySchema.parse({ tab: "all" }))).toHaveLength(0);
  });
});

describe("submit checklist and follow-ups", () => {
  it("only allows 'I submitted it' after every checklist item is ticked", async () => {
    const id = await add(5);
    expect((await savePacket(id, { summary: "Hi", coverLetter: "Dear team", answers: [{ question: "Why?", answer: "Because" }] })).ok).toBe(true);

    const [first, ...rest] = SUBMIT_CHECKLIST;
    await setChecklistItem(id, first.key, true);
    const blocked = await markSubmitted(id);
    expect(blocked).toMatchObject({ ok: false });
    expect((blocked as { error: string }).error).toContain(`${rest.length} left`);

    for (const c of rest) await setChecklistItem(id, c.key, true);
    expect((await markSubmitted(id)).ok).toBe(true);

    const job = await prisma.job.findUniqueOrThrow({ where: { id } });
    expect(job.status).toBe("SUBMITTED");
    const days = (job.followUpAt!.getTime() - job.submittedAt!.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(7);
    expect((await events(id)).map((e) => e.type)).toEqual(["FOUND", "PACKET_SAVED", "SUBMITTED", "FOLLOW_UP_SET"]);
  });

  it("schedules, validates, completes and clears follow-ups", async () => {
    const id = await add(6);
    expect(await setFollowUp(id, "next tuesday")).toMatchObject({ ok: false });
    expect((await setFollowUp(id, "2026-01-02")).ok).toBe(true);
    await prisma.job.update({ where: { id }, data: { status: "SUBMITTED" } });

    // Past date → shows up in the Follow up tab
    const due = await listJobs(alice.id, jobQuerySchema.parse({ tab: "FOLLOWUP" }));
    expect(due.map((j) => j.id)).toContain(id);

    expect((await markFollowedUp(id)).ok).toBe(true);
    const next = await prisma.job.findUniqueOrThrow({ where: { id } });
    expect(next.followUpAt!.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    expect((await events(id)).at(-1)?.type).toBe("FOLLOWED_UP");

    // Getting an interview clears the reminder
    await setJobStatus(id, "INTERVIEW");
    expect((await prisma.job.findUniqueOrThrow({ where: { id } })).followUpAt).toBeNull();
  });
});

describe("profile, search and Claude gating (no Claude calls)", () => {
  it("saves location preferences and rejects bad input", async () => {
    expect((await saveLocationPreferences({ currentLocation: "Karachi, Pakistan", preferredLocations: ["Remote", "UK"], onlyPreferredLocations: true, wantsRelocation: true })).ok).toBe(true);
    const p = await getOrCreateJobProfile(alice.id);
    expect(p).toMatchObject({ currentLocation: "Karachi, Pakistan", preferredLocations: ["Remote", "UK"], onlyPreferredLocations: true });
    expect((await saveLocationPreferences({ currentLocation: "x".repeat(200), preferredLocations: [], onlyPreferredLocations: false, wantsRelocation: true })).ok).toBe(false);
  });

  it("rate-limits job searches to one per 10 minutes", async () => {
    await prisma.jobProfile.update({ where: { userId: alice.id }, data: { lastSearchAt: new Date() } });
    const res = await searchJobs();
    expect(res).toMatchObject({ ok: false });
    expect((res as { error: string }).error).toMatch(/Try again in 10 minutes/);
  });

  it("blocks every Claude action when the user isn't allowed (no API call is made)", async () => {
    const id = await add(7);
    for (const res of [await generatePacket(id), await prepareInterview(id), await suggestProfileFromResume("x".repeat(300))]) {
      expect(res).toMatchObject({ ok: false });
      expect((res as { error: string }).error).toContain("isn’t switched on"); // no API key in tests
    }
  });
});

describe("resume PDF upload", () => {
  it("extracts text from a real PDF and rejects non-PDFs", async () => {
    const { renderToBuffer, Document, Page, Text } = await import("@react-pdf/renderer");
    const { createElement: h } = await import("react");
    const lines = ["Jane Doe", "BSc Computer Science, 2026", "Projects: RAG chatbot in Python with LangChain", "Skills: Python, SQL, prompt engineering"];
    const pdf = await renderToBuffer(h(Document, null, h(Page, null, ...lines.map((l) => h(Text, { key: l }, l)))) as never);

    const fd = new FormData();
    fd.append("resume", new File([new Uint8Array(pdf)], "resume.pdf", { type: "application/pdf" }));
    const res = await extractResumeFromPdf(fd);
    expect(res.ok).toBe(true);
    const text = (res as { data: { text: string; pages: number } }).data;
    expect(text.pages).toBe(1);
    for (const l of lines) expect(text.text).toContain(l);

    const bad = new FormData();
    bad.append("resume", new File(["hello"], "resume.txt", { type: "text/plain" }));
    expect(await extractResumeFromPdf(bad)).toMatchObject({ ok: false, error: "Upload a PDF (.pdf)" });
  });
});

describe("insights", () => {
  it("counts the funnel and response rate from real job states", async () => {
    const ins = await jobInsights(alice.id);
    const by = Object.fromEntries(ins.funnel.map((f) => [f.stage, f.count]));
    expect(by.Found).toBeGreaterThanOrEqual(by.Submitted);
    expect(by.Submitted).toBeGreaterThanOrEqual(2); // job 5 (submitted) + job 6 (interview)
    expect(by.Interview).toBeGreaterThanOrEqual(1);
    expect(ins.responseRate).not.toBeNull();
    expect(ins.weeks).toHaveLength(8);
  });
});

describe("daily digest", () => {
  it("emails new matches and due follow-ups once a day to opted-in users", async () => {
    Object.assign(process.env, { SMTP_HOST: "smtp.test", SMTP_USER: "me@test", SMTP_PASS: "x" });
    try {
      state.user = bob;
      const fresh = await add(8);
      const due = await add(9);
      await prisma.job.update({ where: { id: due }, data: { status: "SUBMITTED", followUpAt: new Date(Date.now() - 86_400_000) } });
      await prisma.jobProfile.update({ where: { userId: bob.id }, data: { dailyDigest: true, lastDigestAt: null } });
      search.newJobIds = [fresh];

      const first = await runDailyDigests({ budgetMs: 10_000 });
      const mine = first.results.find((r) => r.userId === bob.id)!;
      expect(mine).toMatchObject({ newMatches: 1, followUpsDue: 1, emailed: true });
      expect(mail.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: bob.email }));

      const second = await runDailyDigests({ budgetMs: 10_000 });
      expect(second.results.find((r) => r.userId === bob.id)).toBeUndefined(); // already sent today
    } finally {
      for (const k of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS"]) delete process.env[k];
    }
  });
});
