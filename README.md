# AI Job Assistant

A personal job-search workspace for **entry-level AI and GenAI roles worldwide**. It finds this week's postings from free job APIs, ranks them for fit, and uses Claude to draft a tailored application for each one. **You review everything and press submit yourself** on the employer's site.

Built with Next.js 15, TypeScript, PostgreSQL (Prisma), Auth.js, TanStack Query, Tailwind/shadcn/ui and the Anthropic API.

---

## What it does

| Step | What happens |
|---|---|
| **1. Find** | Pulls postings from the last 7 days: about 46 company career boards (OpenAI, Anthropic, Cohere, Perplexity, Scale AI, Databricks, ElevenLabs and more), plus Adzuna, Remotive, Himalayas, Jobicy and Arbeitnow. A typical run scans about 2,000 postings in 15 seconds. |
| **2. Rank** | A free local scorer filters for AI relevance, entry-level signals (graduate, junior, intern, 0–2 years), low-code and GenAI tooling, relocation or visa support, and pay against your minimum. Senior roles are hidden by default. |
| **3. Draft** | Claude reads your resume and the posting and returns a **fit score with strengths and gaps**, a tailored summary, a cover letter, answers to likely screening questions, and a list of things you must verify. It writes only from facts in your resume; anything it can't know becomes a `[placeholder]`. |
| **4. Double-check** | A six-point checklist: the posting is real, your details are correct, the right resume is attached, every answer is rewritten in your own words, no placeholders remain, and work-authorization answers are truthful. |
| **5. Submit** | **Open application** takes you to the employer's form, where you paste from your packet and submit. **I submitted it** stays locked until the checklist is complete, then the job moves to your *Submitted* pipeline. |

Also included:
- **Dashboard:** live KPIs, an activity chart, status breakdown and upcoming deadlines.
- **Project tracker:** search, filters, sorting and pagination, with create, edit and delete.
- **PDF reports:** print-ready A4 reports with a live preview, rendered on the server.
- **Accounts:** email and password sign-in, GitHub and Google OAuth, password reset, and profile with avatar upload.
- **Look and accessibility:** light and dark themes, a mobile-first layout, and WCAG-minded accessibility.

### What it deliberately doesn't do

It **does not scrape, log into, or automate LinkedIn** or any other site; LinkedIn's terms prohibit automated access. LinkedIn jobs can be added by pasting the link and description. It never submits an application for you.

---

## Quick start (macOS)

**One click:** double-click **`Start Nexus.command`**.

On the first run it installs everything it needs into `~/.local`, with no admin password and no Homebrew:
- Node.js 22 LTS (checksum-verified)
- PostgreSQL 17
- the app's dependencies, a database, and demo data

Then it starts the app and opens http://localhost:3000.

- Demo login: `demo@nexus.dev` / `Password123!`
- To stop: close the window or double-click **`Stop Nexus.command`**.

> If macOS says the file "can't be opened because it is from an unidentified developer", right-click it, choose **Open**, then **Open** again. You only need to do this once.

### Manual setup (any OS)

You need Node.js 20+ and PostgreSQL 14+.

```bash
cp .env.example .env            # set DATABASE_URL and AUTH_SECRET (openssl rand -base64 32)
npm install
npx prisma migrate deploy
npm run db:seed                 # optional demo data
npm run dev                     # http://localhost:3000
```

---

## Configuration

All settings live in `.env`, which is never committed. Only the first two are required.

| Variable | Needed for | Where to get it |
|---|---|---|
| `DATABASE_URL` | Everything | Local Postgres, Neon, Supabase or Vercel Postgres |
| `AUTH_SECRET` | Sign-in sessions | `openssl rand -base64 32` |
| `ANTHROPIC_API_KEY` | Claude fit analysis and drafting | [console.anthropic.com](https://console.anthropic.com) (pay per use, a few cents per job) |
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Adzuna search in 19 countries | [developer.adzuna.com](https://developer.adzuna.com) (free) |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | "Sign in with GitHub" | GitHub → Settings → Developer settings → OAuth Apps |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | "Sign in with Google" | Google Cloud Console → Credentials |
| `RESEND_API_KEY` | Password-reset emails | [resend.com](https://resend.com). Without it, reset links print to the terminal. |
| `BLOB_READ_WRITE_TOKEN` | Avatar uploads | A Vercel Blob store |

Without a Claude key, everything except drafting still works, and you can write packets by hand.

---

## Job sources

| Source | Coverage | Key |
|---|---|---|
| Greenhouse, Lever, Ashby | Company career boards you choose (about 46 preset, editable in *Job profile*) | None |
| [Adzuna](https://www.adzuna.com) | Aggregated listings in 19 countries | Free |
| [Remotive](https://remotive.com) | Remote roles worldwide | None |
| [Himalayas](https://himalayas.app) | Remote roles worldwide | None |
| [Jobicy](https://jobicy.com) | Remote roles worldwide | None |
| [Arbeitnow](https://www.arbeitnow.com) | Europe, many with relocation or visa support | None |

Job data belongs to its sources; every application link points to the original posting.

---

## How it's built

```
app/
  (auth)/                 sign in, register, password reset
  (dashboard)/
    jobs/                 job search, job detail (packet + checklist), job profile
    dashboard/ projects/ reports/ settings/
  api/                    projects, stats, PDF reports, Auth.js
actions/                  server actions (jobs, projects, profile, auth), all Zod-validated
lib/
  jobs/                   sources.ts (API clients) · score.ts · sync.ts · ai.ts (Claude)
  pdf/                    PDF report document
  data/                   database queries
prisma/                   schema, migrations, seed
components/               UI (shadcn/ui primitives + feature components)
```

- **Claude:** `claude-opus-5-5`, with structured outputs validated by Zod and a server-side refusal fallback. One request covers fit analysis plus the full packet.
- **Ownership:** every query is scoped to the signed-in user. Server actions re-validate all input, and "submitted" can only be set through the checklist.
- **Design:** "drafting sheet" visuals, with dot-grid paper, a dot-matrix display face (Doto) and dot meters for progress, in light and dark.

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run typecheck` · `npm run lint` | Type and lint checks |
| `npm run db:migrate` · `npm run db:seed` · `npm run db:studio` | Database tools |

### Deploying

The app is ready for Vercel. Add the variables above in the project settings, use a hosted Postgres, and set the build command to `prisma migrate deploy && next build`.

---

## Roadmap

- Rate limiting on sign-in and password reset
- Email verification for new accounts
- Follow-up reminders for submitted applications
- Tests (Zod schemas, server actions, Playwright end-to-end)
