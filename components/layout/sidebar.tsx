import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { NavLinks } from "@/components/layout/nav-links";

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card lg:block">
      <div className="sticky top-0 flex h-dvh flex-col">
        <Link href="/dashboard" className="flex h-16 items-center px-6" aria-label="Nexus dashboard">
          <Logo />
        </Link>
        <div className="dot-rule mx-6" aria-hidden="true" />
        <nav aria-label="Main" className="flex-1 p-4">
          <p className="eyebrow mb-3 px-3">Workspace</p>
          <NavLinks />
        </nav>
        <div className="relative m-4 overflow-hidden rounded-xl border bg-muted/50 p-4">
          <div className="bg-dots-fine absolute inset-0 text-dot" aria-hidden="true" />
          <p className="relative text-sm font-medium">Need a summary?</p>
          <p className="relative mt-1 text-xs text-muted-foreground">Export your portfolio as a print-ready PDF.</p>
          <Link
            href="/reports"
            className="relative mt-3 inline-flex text-xs font-semibold text-primary underline-offset-4 hover:underline"
          >
            Open reports →
          </Link>
        </div>
      </div>
    </aside>
  );
}
