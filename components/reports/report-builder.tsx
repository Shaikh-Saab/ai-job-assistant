"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  PROJECT_STATUSES,
  REPORT_SECTIONS,
  REPORT_SECTION_LABELS,
  STATUS_LABELS,
  type ReportSection,
} from "@/lib/validations";

const SORTS = [
  ["dueDate:asc", "Due date (soonest first)"],
  ["budget:desc", "Budget (largest first)"],
  ["progress:desc", "Progress (most complete)"],
  ["priority:desc", "Priority (high first)"],
  ["name:asc", "Name (A–Z)"],
  ["createdAt:desc", "Newest first"],
] as const;

const DEFAULTS = {
  title: "Portfolio overview",
  status: "",
  priority: "",
  search: "",
  sort: "dueDate:asc",
  sections: [...REPORT_SECTIONS] as ReportSection[],
};

export function ReportBuilder() {
  const [cfg, setCfg] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const set = <K extends keyof typeof cfg>(k: K, v: (typeof cfg)[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const toggleSection = (sec: ReportSection) =>
    set("sections", cfg.sections.includes(sec) ? cfg.sections.filter((x) => x !== sec) : [...cfg.sections, sec]);

  const query = useMemo(() => {
    const [sort, order] = cfg.sort.split(":");
    const p = new URLSearchParams({ sort, order, sections: cfg.sections.join(",") });
    if (cfg.title.trim()) p.set("title", cfg.title.trim());
    if (cfg.status) p.set("status", cfg.status);
    if (cfg.priority) p.set("priority", cfg.priority);
    if (cfg.search.trim()) p.set("search", cfg.search.trim());
    return p.toString();
  }, [cfg]);

  // Typing shouldn't regenerate the PDF on every keystroke.
  const previewQuery = useDebounce(query, 600);
  const previewUrl = `/api/reports/projects?${previewQuery}`;
  const noSections = cfg.sections.length === 0;

  // Each new preview URL remounts the iframe (key) and shows the spinner until it loads.
  useEffect(() => setLoading(true), [previewUrl]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      {/* Settings */}
      <form
        className="space-y-6 self-start rounded-xl border bg-card p-6 lg:sticky lg:top-24"
        onSubmit={(e) => e.preventDefault()}
        aria-label="Report settings"
      >
        <FormField id="report-title" label="Report title">
          {(aria) => (
            <Input maxLength={80} value={cfg.title} onChange={(e) => set("title", e.target.value)} {...aria} />
          )}
        </FormField>

        <div className="dot-rule" aria-hidden="true" />

        <fieldset className="space-y-4">
          <legend className="eyebrow mb-3">Scope</legend>
          <div className="grid grid-cols-2 gap-3">
            <FormField id="report-status" label="Status">
              {(aria) => (
                <NativeSelect value={cfg.status} onChange={(e) => set("status", e.target.value)} {...aria}>
                  <option value="">All</option>
                  {PROJECT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField id="report-priority" label="Priority">
              {(aria) => (
                <NativeSelect value={cfg.priority} onChange={(e) => set("priority", e.target.value)} {...aria}>
                  <option value="">All</option>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABELS[p]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          </div>
          <FormField id="report-search" label="Name contains" hint="Optional. Matches project names and descriptions.">
            {(aria) => (
              <Input type="search" value={cfg.search} onChange={(e) => set("search", e.target.value)} placeholder="e.g. API" {...aria} />
            )}
          </FormField>
          <FormField id="report-sort" label="Order rows by">
            {(aria) => (
              <NativeSelect value={cfg.sort} onChange={(e) => set("sort", e.target.value)} {...aria}>
                {SORTS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
        </fieldset>

        <div className="dot-rule" aria-hidden="true" />

        <fieldset>
          <legend className="eyebrow mb-3">Sections</legend>
          <ul className="space-y-2">
            {REPORT_SECTIONS.map((sec) => {
              const on = cfg.sections.includes(sec);
              return (
                <li key={sec}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      on ? "border-primary/40 bg-accent text-accent-foreground" : "hover:bg-muted",
                    )}
                  >
                    <input type="checkbox" checked={on} onChange={() => toggleSection(sec)} className="h-4 w-4 accent-[hsl(var(--primary))]" />
                    {REPORT_SECTION_LABELS[sec]}
                  </label>
                </li>
              );
            })}
          </ul>
          {noSections && (
            <p role="alert" className="mt-2 text-xs font-medium text-destructive">
              Pick at least one section. With none selected, the report includes all of them.
            </p>
          )}
        </fieldset>

        <div className="flex flex-col gap-2">
          <Button asChild>
            <a href={`/api/reports/projects?${query}&download=1`}>
              <Download aria-hidden="true" /> Download PDF
            </a>
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" asChild>
              <a href={`/api/reports/projects?${query}`} target="_blank" rel="noopener">
                <ExternalLink aria-hidden="true" /> Open
              </a>
            </Button>
            <Button variant="ghost" type="button" onClick={() => setCfg(DEFAULTS)}>
              <RotateCcw aria-hidden="true" /> Reset
            </Button>
          </div>
        </div>
      </form>

      {/* Live preview on the dotted "cutting mat" */}
      <section aria-label="Report preview" className="relative overflow-hidden rounded-xl border bg-muted/40 p-3 sm:p-6">
        <div className="bg-dots pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative mb-3 flex items-center justify-between">
          <p className="eyebrow">Live preview · A4</p>
          {loading && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Rendering…
            </p>
          )}
        </div>
        <div className="relative mx-auto aspect-[1/1.414] w-full max-w-[820px] overflow-hidden rounded-md bg-white shadow-[0_24px_60px_-20px_rgba(14,23,38,0.35)]">
          <iframe
            key={previewUrl}
            src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`}
            title="PDF report preview"
            className={cn("h-full w-full transition-opacity", loading && "opacity-40")}
            onLoad={() => setLoading(false)}
          />
        </div>
      </section>
    </div>
  );
}
