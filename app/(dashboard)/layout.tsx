import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { ProjectDialogs } from "@/components/projects/project-dialogs";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Middleware already guards these routes; this is defense in depth.
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Dot-grid paper behind the working area */}
        <div className="bg-dots bg-dots-fade pointer-events-none absolute inset-x-0 top-0 h-[520px]" aria-hidden="true" />
        <Header user={session.user} />
        <main id="main" className="relative mx-auto w-full max-w-[1400px] flex-1 space-y-8 p-4 sm:p-6 lg:p-10">
          {children}
        </main>
      </div>
      <ProjectDialogs />
    </div>
  );
}
