import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { auth } from "@/auth";
import { PageHeader } from "@/components/layout/page-header";
import { JobProfileForm } from "@/components/jobs/profile-form";
import { getOrCreateJobProfile } from "@/lib/data/jobs";
import { aiAllowedFor } from "@/lib/jobs/ai";

// Job search fans out to ~50 APIs and Claude drafting can take ~a minute.
export const maxDuration = 60;

export const metadata: Metadata = { title: "Job profile" };

export default async function JobProfilePage() {
  const session = await auth();
  const p = await getOrCreateJobProfile(session!.user.id);

  return (
    <>
      <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Job search
      </Link>
      <PageHeader
        eyebrow="Job search"
        title="Job profile"
        description="Your resume and what to look for. Pre-filled for entry-level AI and GenAI roles worldwide; adjust anything."
      />
      <JobProfileForm
        aiReady={aiAllowedFor(session!.user.email)}
        adzunaReady={!!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY)}
        initial={{
          headline: p.headline,
          resumeText: p.resumeText,
          skills: p.skills,
          roleKeywords: p.roleKeywords,
          countries: p.countries,
          greenhouseBoards: p.greenhouseBoards,
          ashbyBoards: p.ashbyBoards,
          leverBoards: p.leverBoards,
          minSalaryUsd: p.minSalaryUsd,
          wantsRelocation: p.wantsRelocation,
          entryLevelOnly: p.entryLevelOnly,
        }}
      />
    </>
  );
}
