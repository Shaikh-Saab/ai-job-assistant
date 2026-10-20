import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { NewProjectButton } from "@/components/projects/new-project-button";
import { ProjectsTable } from "@/components/projects/projects-table";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Register"
        title="Projects"
        description="Search, filter and manage all of your projects."
        actions={<NewProjectButton />}
      />
      {/* useSearchParams() requires a Suspense boundary */}
      <Suspense fallback={<Skeleton className="h-[480px] w-full" />}>
        <ProjectsTable />
      </Suspense>
    </>
  );
}
