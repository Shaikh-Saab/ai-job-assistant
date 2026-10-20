import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Halftone } from "@/components/brand/halftone";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const FEATURES = [
  ["Live dashboard", "KPIs and charts that refresh on their own"],
  ["Project register", "Search, filter, sort and edit every project"],
  ["PDF reports", "Print-ready portfolio sheets in one click"],
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* Form column */}
      <div className="relative flex flex-col">
        <div className="bg-dots bg-dots-fade pointer-events-none absolute inset-0" aria-hidden="true" />
        <header className="relative flex items-center justify-between px-4 py-5 sm:px-8">
          <Link href="/" aria-label="Nexus home">
            <Logo />
          </Link>
          <ThemeToggle />
        </header>
        <main id="main" className="relative flex flex-1 items-center justify-center px-4 pb-16 sm:px-8">
          <div className="w-full max-w-[420px]">{children}</div>
        </main>
      </div>

      {/* Showcase panel (always dark ink, like a cutting mat) */}
      <aside className="relative hidden overflow-hidden bg-[hsl(var(--ink-panel))] text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Halftone className="absolute inset-0 h-full w-full text-[#3b6cf0] opacity-80" />
        <div className="relative font-mono text-[11px] uppercase tracking-[0.18em] text-white/60">
          Sheet 01 · Portfolio overview
        </div>

        <div className="relative max-w-md space-y-8">
          <h2 className="font-display text-5xl font-semibold leading-[1.02] tracking-tight">
            Every project,
            <br />
            on one sheet.
          </h2>
          <ul className="space-y-4">
            {FEATURES.map(([title, text]) => (
              <li key={title} className="flex gap-4">
                <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#f5b544]" aria-hidden="true" />
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="text-sm text-white/65">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <figure className="relative grid max-w-md grid-cols-3 gap-px overflow-hidden rounded-xl border border-white/15 bg-white/10 backdrop-blur-sm">
          {[
            ["24", "Projects"],
            ["57%", "Avg. progress"],
            ["$1.38M", "Budget"],
          ].map(([v, l]) => (
            <div key={l} className="bg-[hsl(var(--ink-panel))]/70 p-4">
              <div className="font-dot text-3xl font-black leading-none">{v}</div>
              <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/60">{l}</div>
            </div>
          ))}
          <figcaption className="col-span-3 bg-[hsl(var(--ink-panel))]/70 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">
            Sample figures from the demo workspace
          </figcaption>
        </figure>
      </aside>
    </div>
  );
}
