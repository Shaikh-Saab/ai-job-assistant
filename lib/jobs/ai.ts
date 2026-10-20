import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import type { Job, JobProfile } from "@prisma/client";

/*
 * Claude integration. Two calls, both structured outputs validated by zod:
 *  - parseResume: resume text → headline, skills, role keywords (fills the search profile)
 *  - draftApplication: job + resume → fit analysis + an application packet the user reviews
 * Nothing here submits anything; the user reviews and submits on the employer's site.
 */

const MODEL = "claude-opus-5-5";

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

export const aiConfigured = () => !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

export class AIError extends Error {}

/** Shared request path: structured output, refusal check, friendly errors. */
async function structured<T extends z.ZodType>(schema: T, system: string, user: string, effort: "low" | "medium") {
  try {
    const response = await anthropic().beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // If the model declines on policy grounds, the API retries on its default fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      messages: [{ role: "user", content: user }],
      output_config: { effort, format: betaZodOutputFormat(schema) },
    });
    if (response.stop_reason === "refusal") throw new AIError("Claude declined this request. Try editing the job text.");
    if (response.stop_reason === "max_tokens") throw new AIError("The response was cut off. Try again.");
    if (!response.parsed_output) throw new AIError("Claude's reply couldn't be read. Try again.");
    return response.parsed_output as z.infer<T>;
  } catch (e) {
    if (e instanceof AIError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AIError("The Anthropic API key is invalid. Check ANTHROPIC_API_KEY in .env.");
    if (e instanceof Anthropic.RateLimitError) throw new AIError("Rate limited by the Anthropic API. Wait a minute and retry.");
    if (e instanceof Anthropic.APIError) throw new AIError(`Anthropic API error (${e.status ?? "network"}). Try again shortly.`);
    throw e;
  }
}

// ---------- Resume → profile ----------

const ProfileDraft = z.object({
  headline: z.string().describe("One line, e.g. 'Computer Science graduate focused on applied GenAI'"),
  skills: z.array(z.string()).describe("Concrete skills/tools that appear in the resume, max 15"),
  roleKeywords: z.array(z.string()).describe("Job-title keywords this person should search for, max 15"),
});

export async function parseResume(resumeText: string) {
  return structured(
    ProfileDraft,
    "You extract job-search settings from a resume. Only list skills the resume actually shows. " +
      "Role keywords should be realistic entry-level titles in AI / GenAI / ML / AI automation that fit this person.",
    `<resume>\n${resumeText}\n</resume>`,
    "low",
  );
}

// ---------- Job + resume → fit analysis + application packet ----------

const PacketDraft = z.object({
  fitScore: z.number().int().min(0).max(100).describe("How well the resume matches this job's requirements"),
  fitSummary: z.string().describe("2–3 sentences: honest overall assessment"),
  strengths: z.array(z.string()).describe("Requirements the resume clearly meets, with evidence"),
  gaps: z.array(z.string()).describe("Requirements the resume doesn't show"),
  summary: z.string().describe("A 3–4 sentence professional summary tailored to this role, for the application form"),
  coverLetter: z.string().describe("Under 250 words. No placeholders except those in [square brackets] the user must fill"),
  answers: z
    .array(z.object({ question: z.string(), answer: z.string() }))
    .describe("Drafts for screening questions this employer is likely to ask"),
  checks: z.array(z.string()).describe("Things the applicant must verify or fill in before submitting"),
});

export type PacketDraft = z.infer<typeof PacketDraft>;

const DRAFT_SYSTEM = `You help a fresh graduate apply to jobs. You write drafts they will review, edit and submit themselves.

Rules:
- Use only facts present in the resume. Never invent employers, degrees, dates, metrics, or skills.
- Where an answer needs a fact the resume lacks (visa status, notice period, salary expectation, start date, portfolio link), write a [bracketed placeholder] and add it to "checks".
- Be honest in the fit assessment. If a requirement is clearly unmet, say so in "gaps"; don't soften it.
- Plain, confident, specific language. No clichés like "I am writing to express my interest" or "passionate".
- Answers: cover "Why this company?", "Why this role?", "Tell us about a relevant project", and work authorization / relocation, plus any questions the posting itself asks.`;

export async function draftApplication(job: Job, profile: JobProfile) {
  const user = [
    `<job>`,
    `Title: ${job.title}`,
    `Company: ${job.company}`,
    `Location: ${job.location}${job.remote ? " (remote)" : ""}`,
    job.salaryText ? `Pay: ${job.salaryText}` : null,
    ``,
    job.description || "(No description captured; base the draft on the title and company.)",
    `</job>`,
    ``,
    `<applicant>`,
    profile.headline ? `Headline: ${profile.headline}` : null,
    profile.skills.length ? `Skills: ${profile.skills.join(", ")}` : null,
    `Open to relocation: ${profile.wantsRelocation ? "yes" : "no"}`,
    ``,
    profile.resumeText,
    `</applicant>`,
  ]
    .filter((l) => l !== null)
    .join("\n");

  return structured(PacketDraft, DRAFT_SYSTEM, user, "medium");
}

export const AI_MODEL = MODEL;
