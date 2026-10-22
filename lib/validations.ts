import { z } from "zod";

// ---------- Auth ----------

const password = z
  .string()
  .min(8, "At least 8 characters")
  .max(72, "At most 72 characters") // bcrypt truncates beyond 72 bytes
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a number");

const email = z.string().trim().toLowerCase().email("Enter a valid email");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "At least 2 characters").max(50),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1),
    password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

// ---------- Profile ----------

export const profileSchema = z.object({
  name: z.string().trim().min(2, "At least 2 characters").max(50),
  bio: z.string().trim().max(280, "At most 280 characters").optional().or(z.literal("")),
});

export const preferencesSchema = z.object({
  emailNotifications: z.boolean(),
});

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

// ---------- Projects ----------

export const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

export const STATUS_LABELS: Record<(typeof PROJECT_STATUSES)[number], string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
};

export const PRIORITY_LABELS: Record<(typeof PRIORITIES)[number], string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
};

export const projectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  status: z.enum(PROJECT_STATUSES),
  priority: z.enum(PRIORITIES),
  budget: z
    .number({ invalid_type_error: "Enter a number" })
    .int("Whole numbers only")
    .min(0, "Cannot be negative")
    .max(1_000_000_000),
  progress: z
    .number({ invalid_type_error: "Enter a number" })
    .int("Whole numbers only")
    .min(0)
    .max(100, "0–100"),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional()
    .or(z.literal("")),
});

export type ProjectInput = z.infer<typeof projectSchema>;

export const SORTABLE_COLUMNS = ["name", "status", "priority", "budget", "progress", "dueDate", "createdAt"] as const;
export type SortColumn = (typeof SORTABLE_COLUMNS)[number];

export const projectQuerySchema = z.object({
  // .catch() falls back to defaults on malformed URLs instead of erroring.
  page: z.coerce.number().int().min(1).default(1).catch(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(10).catch(10),
  search: z.string().trim().max(100).optional().default("").catch(""),
  status: z.enum(PROJECT_STATUSES).optional().catch(undefined),
  priority: z.enum(PRIORITIES).optional().catch(undefined),
  sort: z.enum(SORTABLE_COLUMNS).default("createdAt").catch("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc").catch("desc"),
});

export type ProjectQuery = z.infer<typeof projectQuerySchema>;

// ---------- Reports ----------

export const REPORT_SECTIONS = ["summary", "status", "activity", "projects"] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];

export const REPORT_SECTION_LABELS: Record<ReportSection, string> = {
  summary: "Key figures",
  status: "Status breakdown",
  activity: "Monthly activity",
  projects: "Project register",
};

export const reportQuerySchema = projectQuerySchema
  .pick({ search: true, status: true, priority: true, sort: true, order: true })
  .extend({
    title: z.string().trim().max(80).optional().catch(undefined),
    sections: z
      .string()
      .optional()
      .transform((v): ReportSection[] => {
        const picked = (v ?? REPORT_SECTIONS.join(","))
          .split(",")
          .filter((s): s is ReportSection => (REPORT_SECTIONS as readonly string[]).includes(s));
        return picked.length ? picked : [...REPORT_SECTIONS];
      }),
    download: z
      .string()
      .optional()
      .transform((v) => v === "1"),
  });

export type ReportQuery = z.infer<typeof reportQuerySchema>;

// ---------- Job search ----------

export const JOB_STATUSES = ["NEW", "SHORTLISTED", "PREPARED", "SUBMITTED", "INTERVIEW", "OFFER", "REJECTED", "SKIPPED"] as const;
export type JobStatusValue = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABELS: Record<JobStatusValue, string> = {
  NEW: "New", SHORTLISTED: "Shortlisted", PREPARED: "Ready to submit", SUBMITTED: "Submitted",
  INTERVIEW: "Interview", OFFER: "Offer", REJECTED: "Rejected", SKIPPED: "Skipped",
};

export const JOB_SOURCE_LABELS: Record<string, string> = {
  GREENHOUSE: "Greenhouse", LEVER: "Lever", ASHBY: "Ashby", ADZUNA: "Adzuna", REMOTIVE: "Remotive",
  ARBEITNOW: "Arbeitnow", HIMALAYAS: "Himalayas", JOBICY: "Jobicy", MANUAL: "Added by you",
};

/** The pre-submit checklist. Every item must be ticked before a job can be marked submitted. */
export const SUBMIT_CHECKLIST = [
  { key: "posting", label: "The posting is still open and on the company’s real careers site" },
  { key: "details", label: "Name, email, phone and links on the form are correct" },
  { key: "resume", label: "I attached my latest resume (right version for this role)" },
  { key: "answers", label: "I read every answer and rewrote it in my own words" },
  { key: "placeholders", label: "No [bracketed placeholders] are left anywhere" },
  { key: "eligibility", label: "Work authorization, visa and relocation answers are truthful" },
] as const;
export type ChecklistKey = (typeof SUBMIT_CHECKLIST)[number]["key"];

const slug = z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]*$/, "Use the board name from the URL, e.g. openai");
const listOf = (item: z.ZodString, max: number) => z.array(item).max(max);

export const jobProfileSchema = z.object({
  headline: z.string().trim().max(160),
  resumeText: z.string().trim().max(30_000, "Resume is too long (30,000 characters max)"),
  skills: listOf(z.string().trim().min(1).max(60), 40),
  roleKeywords: listOf(z.string().trim().min(1).max(60), 40).min(1, "Add at least one role keyword"),
  countries: listOf(z.string().trim().toLowerCase().length(2), 19),
  greenhouseBoards: listOf(slug, 60),
  leverBoards: listOf(slug, 60),
  ashbyBoards: listOf(slug, 60),
  minSalaryUsd: z.number().int().min(0).max(10_000_000).nullable(),
  wantsRelocation: z.boolean(),
  entryLevelOnly: z.boolean(),
  currentLocation: z.string().trim().max(120),
  preferredLocations: listOf(z.string().trim().min(1).max(60), 30),
  onlyPreferredLocations: z.boolean(),
});
export type JobProfileInput = z.infer<typeof jobProfileSchema>;

export const locationPrefsSchema = jobProfileSchema.pick({
  currentLocation: true,
  preferredLocations: true,
  onlyPreferredLocations: true,
  wantsRelocation: true,
});
export type LocationPrefsInput = z.infer<typeof locationPrefsSchema>;

export const manualJobSchema = z.object({
  url: z.string().trim().url("Paste the full job link"),
  title: z.string().trim().min(2, "Add the job title").max(240),
  company: z.string().trim().min(1, "Add the company").max(160),
  location: z.string().trim().max(240).optional().or(z.literal("")),
  description: z.string().trim().max(20_000).optional().or(z.literal("")),
});
export type ManualJobInput = z.infer<typeof manualJobSchema>;

export const packetSchema = z.object({
  summary: z.string().max(5_000),
  coverLetter: z.string().max(10_000),
  answers: z.array(z.object({ question: z.string().max(500), answer: z.string().max(5_000) })).max(30),
});
export type PacketInput = z.infer<typeof packetSchema>;

export const jobQuerySchema = z.object({
  tab: z.enum(["active", ...JOB_STATUSES, "all"]).default("active").catch("active"),
  q: z.string().trim().max(100).optional().catch(undefined),
  source: z.string().max(20).optional().catch(undefined),
  minScore: z.coerce.number().int().min(0).max(100).default(0).catch(0),
  week: z.enum(["1", "0"]).default("1").catch("1"),
});
export type JobQuery = z.infer<typeof jobQuerySchema>;
