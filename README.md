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
- **Follow-up reminders:** submitting schedules a reminder 7 days out. Due follow-ups show in a **Follow up** tab and banner, and you can snooze, clear or log them.
- **Daily digest:** turn it on in *Job profile*. Every morning the app runs your search and emails your best new matches plus any follow-ups that are due.
- **Insights:** your funnel (found → shortlisted → prepared → submitted → interview → offer), response and interview rates, applications per week, and which sources produce your interviews.
- **Activity history:** a timeline on every job: found, drafted, edited, submitted, followed up, status changes.
- **Resume PDF upload:** upload your resume as a PDF and its text is extracted for you (no AI needed).
- **Interview prep (Claude):** likely questions with answer outlines from your resume, STAR stories to prepare, topics to revise, and questions to ask them.
- **CSV export:** download every tracked job for Excel or Google Sheets.
- **Location preferences:** in **Settings → Location**, set where you live and where you want to work (cities, countries or "Remote"). Matching postings rank higher, or you can hide everything else.
- **Dashboard:** live KPIs, an activity chart, status breakdown and upcoming deadlines.
- **Project tracker:** search, filters, sorting and pagination, with create, edit and delete.
- **PDF reports:** print-ready A4 reports with a live preview, rendered on the server.
- **Accounts:** email and password sign-in, "Continue with Google" (and GitHub) through **Firebase Authentication** or plain OAuth, password reset by email, and profile with avatar upload.
- **Safe sign-in:** after **5 wrong passwords**, sign-in for that email pauses for **15 minutes**. The form says plainly how many tries are left and offers a reset link. It's enforced on the server, so scripts can't skip it.
- **Easy for everyone, including older users:** large text and buttons, a **"Larger text"** switch on every page, plain-language labels and messages, a **Show** button on password boxes, a **Caps Lock is on** warning, and a password checklist that ticks off each rule as you type.
- **Look and accessibility:** light and dark themes, a mobile-first layout, and WCAG-minded accessibility.

### What it deliberately doesn't do

It **does not scrape, log into, or automate LinkedIn** or any other site; LinkedIn's terms prohibit automated access. LinkedIn jobs can be added by pasting the link and description. It never submits an application for you.

---

## Live demo

**https://ai-job-assistant-liard.vercel.app** (create an account to try it; Claude drafting is limited to the owner).

---

## Run it on Windows

Steps for Windows 10/11 (PowerShell and [winget](https://learn.microsoft.com/windows/package-manager/winget/) come with Windows 11 and recent Windows 10).

**1. Download the code**
- **Without Git:** on the GitHub page click **Code → Download ZIP**, then right-click the ZIP → **Extract All…** (for example to `Documents\ai-job-assistant`).
- **With Git:** `git clone https://github.com/Shaikh-Saab/ai-job-assistant.git`

**2. Double-click `Start Nexus (Windows).bat`** in the extracted folder.

The first run walks you through setup:
- Installs **Node.js LTS** with winget if you don't have it (accept the Windows prompt).
- Asks which **database** to use:
  1. **Free cloud database (easiest):** create a project at [supabase.com](https://supabase.com) or [neon.tech](https://neon.tech), copy its *connection string*, and paste it.
  2. **Install PostgreSQL on this PC:** winget installs PostgreSQL 17 with the password `postgres`.
  3. **Already have PostgreSQL:** uses `postgres` / `postgres` on `localhost:5432`.
- Creates `.env` with a random sign-in secret, installs packages, creates the tables and loads demo data.

It then opens **http://localhost:3000**. Sign in with `demo@nexus.dev` / `Password123!`.

After that, `Start Nexus (Windows).bat` just starts the app. Keep its window open while you use it; press **Ctrl+C** or close the window to stop.

> **"Windows protected your PC"?** Click **More info → Run anyway** (the script is plain text; open it in Notepad to read it first).
> **"npm is not recognized" right after Node installs?** Close the window and double-click the `.bat` again so Windows picks up the new PATH.
> To redo setup (e.g. switch databases), delete `.env` and run `Setup Nexus (Windows).bat`.

<details>
<summary>Manual Windows setup (PowerShell)</summary>

```powershell
winget install -e --id OpenJS.NodeJS.LTS      # Node.js 20+
cd ai-job-assistant
copy .env.example .env                         # then edit DATABASE_URL, DIRECT_URL and AUTH_SECRET in Notepad
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev                                    # http://localhost:3000
```
</details>

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
| `FIREBASE_API_KEY`, `FIREBASE_SERVICE_ACCOUNT` | **Firebase sign-in** (recommended, free): Google button + password-reset emails with no email setup | See [Setting up Firebase](#setting-up-firebase-sign-in-free) below |
| `FIREBASE_SIGN_IN_PROVIDERS` | Optional: which Firebase buttons to show | `google` (default) or `google,github` |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | "Sign in with GitHub" | GitHub → Settings → Developer settings → OAuth Apps |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | "Sign in with Google" | Google Cloud Console → Credentials |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | Password-reset emails | **Gmail (free):** turn on 2-Step Verification, create an [App Password](https://myaccount.google.com/apppasswords), then use `smtp.gmail.com`, port `465`, your Gmail address and the 16-letter app password. Brevo's free SMTP works too. |
| `RESEND_API_KEY` | Password-reset emails (alternative) | [resend.com](https://resend.com); needs a verified domain to email other people |
| `BLOB_READ_WRITE_TOKEN` | Avatar uploads | A Vercel Blob store |

Without a Claude key, everything except drafting still works, and you can write packets by hand. With Firebase set up, Firebase sends the reset emails and you don't need any email setting for that (SMTP is then only used for the daily digest). Without Firebase or an email setting, "Forgot password" tells users it isn't available instead of failing silently (locally, reset links print to the terminal). The **GitHub** and **Google** sign-in buttons only appear once their keys are set.

### Setting up Firebase sign-in (free)

Firebase's free Spark plan covers this app's sign-in, and Firebase sends the password-reset emails itself.

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Create a project** (Google Analytics can be off).
2. **Build → Authentication → Get started.** Under **Sign-in method**, turn on **Email/Password** and **Google**. For GitHub, also turn on **GitHub** and paste in a GitHub OAuth app's ID and secret, using the callback URL Firebase shows you.
3. **Authentication → Settings → Authorized domains → Add domain:** your site, e.g. `ai-job-assistant-liard.vercel.app`. `localhost` is already there.
4. **Project settings (gear) → General → Web API Key:** copy it into `FIREBASE_API_KEY`. If you see no key, click **Add app → Web (`</>`)** once and it appears.
5. **Project settings → Service accounts → Generate new private key.** This downloads a JSON file. Paste the **whole file contents** into `FIREBASE_SERVICE_ACCOUNT`. Treat it like a password and never commit it.
6. Redeploy. The sign-in pages switch to Firebase on their own.

**Existing accounts keep working.** The first time someone signs in with their old password, the app quietly moves them to Firebase with the same password. A "Continue with Google" sign-in joins an existing account with the same (Google-verified) email. An unverified Firebase account can never take over an existing one.

### Setting up "Sign in with GitHub / Google" without Firebase

- **GitHub:** go to GitHub → Settings → Developer settings → **OAuth Apps → New OAuth App**. Use your site URL as the homepage and `https://YOUR-SITE/api/auth/callback/github` as the callback URL. Copy the Client ID into `AUTH_GITHUB_ID`, generate a client secret, and copy it into `AUTH_GITHUB_SECRET`.
- **Google:** in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), go to **Create credentials → OAuth client ID → Web application**. Add `https://YOUR-SITE/api/auth/callback/google` as an authorized redirect URI, then copy the values into `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`. You'll first be asked to set up the OAuth consent screen: choose "External" and add your email as a test user.
- For local use, the callback URLs start with `http://localhost:3000`.

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
| `npm test` | Unit and integration tests (see below) |
| `npm run test:smoke` | End-to-end checks against a running app |
| `npm run test:all` | Type check, lint, tests and smoke checks |

### Tests

```bash
npm test                 # 78 unit + integration tests (Vitest)
npm run test:smoke       # 28 end-to-end checks against http://localhost:3000 (start the app first)
BASE_URL=https://your-site EMAIL=you@x.com PASSWORD=… npm run test:smoke   # against a deployment
```

- **Unit tests:** job scoring and location matching, HTML and salary parsing, CSV (including formula-injection protection), Zod validation, PDF report maths, email building and escaping, and the owner-only Claude gate.
- **Integration tests:** the real server actions against a **separate `nexus_test` database**, which is never your real data. They cover project CRUD and ownership, sign-up, the full password-reset flow (including reused and expired links), the wrong-password pause (countdown, 15-minute pause, parallel guesses, unknown emails), Firebase sign-in with a fake Firebase (moving old accounts over, Google sign-in, blocking account takeover, stale tokens, reset emails, outages), adding and tracking jobs, the submit checklist, follow-ups, activity history, search rate-limiting, resume PDF extraction, insights, the daily digest, CSV export, PDF reports and cron protection.
- Create the test database once: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nexus_test npx prisma migrate deploy`, or set `TEST_DATABASE_URL`.
- **Claude isn't called in tests:** they check that Claude features are blocked for non-owners, without spending API credit.

### Deploying

The app is ready for Vercel: `vercel.json` sets the region, the build and the daily cron job. Add the variables above in the project settings, use a hosted Postgres such as Supabase or Neon, and add a random `CRON_SECRET`. Vercel sends it to `/api/cron/daily` each morning (03:00 UTC). On other hosts, call that URL daily with `Authorization: Bearer <CRON_SECRET>`.

---

## Roadmap

- Rate limiting on password-reset requests
- Email verification for new accounts
- Browser end-to-end tests (Playwright) for the main flows
