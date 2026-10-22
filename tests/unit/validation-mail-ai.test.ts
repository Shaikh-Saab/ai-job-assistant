import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  jobProfileSchema, loginSchema, manualJobSchema, projectQuerySchema, registerSchema, reportQuerySchema,
} from "@/lib/validations";

describe("validation", () => {
  it("normalises login email and requires a password", () => {
    expect(loginSchema.parse({ email: "  Me@Example.COM ", password: "x" }).email).toBe("me@example.com");
    expect(loginSchema.safeParse({ email: "me@example.com", password: "" }).success).toBe(false);
  });

  it("enforces password strength and matching on register", () => {
    const base = { name: "Ann", email: "a@b.co", confirmPassword: "Password1" };
    expect(registerSchema.safeParse({ ...base, password: "Password1" }).success).toBe(true);
    expect(registerSchema.safeParse({ ...base, password: "password1", confirmPassword: "password1" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "Password2" }).success).toBe(false);
  });

  it("falls back to safe defaults on malformed table queries", () => {
    const q = projectQuerySchema.parse({ page: "abc", pageSize: "9999", sort: "DROP TABLE", status: "nope" });
    expect(q).toMatchObject({ page: 1, pageSize: 10, sort: "createdAt", order: "desc", status: undefined });
  });

  it("keeps only known report sections", () => {
    expect(reportQuerySchema.parse({ sections: "summary,evil,projects" }).sections).toEqual(["summary", "projects"]);
    expect(reportQuerySchema.parse({}).sections).toHaveLength(4);
  });

  it("validates job board names and manual job links", () => {
    const profile = {
      headline: "", resumeText: "", skills: [], roleKeywords: ["AI"], countries: ["gb"], greenhouseBoards: ["anthropic"],
      leverBoards: [], ashbyBoards: [], minSalaryUsd: null, wantsRelocation: true, entryLevelOnly: true,
      currentLocation: "Karachi", preferredLocations: ["Remote"], onlyPreferredLocations: false,
    };
    expect(jobProfileSchema.safeParse(profile).success).toBe(true);
    expect(jobProfileSchema.safeParse({ ...profile, greenhouseBoards: ["../etc/passwd"] }).success).toBe(false);
    expect(jobProfileSchema.safeParse({ ...profile, roleKeywords: [] }).success).toBe(false);
    expect(manualJobSchema.safeParse({ url: "not a url", title: "AI", company: "X" }).success).toBe(false);
  });
});

// vi.mock is hoisted above imports, so the spy must be created with vi.hoisted.
const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn().mockResolvedValue({ messageId: "1" }) }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail }) } }));

describe("email", () => {
  const env = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    sendMail.mockClear();
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it("sends the reset email over SMTP with a working link", async () => {
    Object.assign(process.env, { SMTP_HOST: "smtp.test", SMTP_USER: "me@test", SMTP_PASS: "x", EMAIL_FROM: "Nexus <me@test>" });
    const { sendPasswordResetEmail, emailConfigured } = await import("@/lib/mail");
    expect(emailConfigured()).toBe(true);
    await sendPasswordResetEmail("user@example.com", "tok/en+1");
    expect(sendMail).toHaveBeenCalledOnce();
    const msg = sendMail.mock.calls[0][0];
    expect(msg).toMatchObject({ to: "user@example.com", from: "Nexus <me@test>", subject: "Reset your Nexus password" });
    expect(msg.text).toContain("https://nexus.test/reset-password?token=tok%2Fen%2B1");
  });

  it("prefers the public production URL over the protected deployment URL", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    Object.assign(process.env, { VERCEL_URL: "app-abc123-team.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "app.vercel.app" });
    const { appUrl } = await import("@/lib/mail");
    expect(appUrl()).toBe("https://app.vercel.app");
  });

  it("reports email as not configured with no provider", async () => {
    for (const k of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "RESEND_API_KEY"]) delete process.env[k];
    const { emailConfigured } = await import("@/lib/mail");
    expect(emailConfigured()).toBe(false);
  });

  it("escapes job titles in the digest email", async () => {
    Object.assign(process.env, { SMTP_HOST: "smtp.test", SMTP_USER: "me@test", SMTP_PASS: "x" });
    const { sendDigestEmail } = await import("@/lib/mail");
    await sendDigestEmail("u@example.com", "Ann Lee", [{ id: "j1", title: "<script>x</script>", company: "A&B", location: "", score: 90 }], []);
    const { html, subject } = sendMail.mock.calls[0][0];
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(html).toContain("A&amp;B");
    expect(subject).toBe("1 new AI role");
  });
});

describe("Claude access gate (no API calls)", () => {
  const env = { ...process.env };
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllEnvs();
  });

  it("is closed without an API key", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    const { aiAllowedFor } = await import("@/lib/jobs/ai");
    expect(aiAllowedFor("owner@example.com")).toBe(false);
  });

  it("allows only owner emails in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    Object.assign(process.env, { ANTHROPIC_API_KEY: "sk-test", AI_OWNER_EMAILS: "Owner@Example.com, second@x.io" });
    const { aiAllowedFor } = await import("@/lib/jobs/ai");
    expect(aiAllowedFor("owner@example.com")).toBe(true);
    expect(aiAllowedFor("second@x.io")).toBe(true);
    expect(aiAllowedFor("stranger@example.com")).toBe(false);
    expect(aiAllowedFor(null)).toBe(false);
  });

  it("is closed in production when no owner list is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    Object.assign(process.env, { ANTHROPIC_API_KEY: "sk-test" });
    delete process.env.AI_OWNER_EMAILS;
    const { aiAllowedFor } = await import("@/lib/jobs/ai");
    expect(aiAllowedFor("anyone@example.com")).toBe(false);
  });
});
