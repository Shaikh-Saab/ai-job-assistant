"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { saveJobProfile, suggestProfileFromResume } from "@/actions/jobs";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ADZUNA_COUNTRIES } from "@/lib/jobs/defaults";
import { cn } from "@/lib/utils";
import type { JobProfileInput } from "@/lib/validations";

const toList = (s: string) => [...new Set(s.split(/[\n,]+/).map((x) => x.trim()).filter(Boolean))];
const fromList = (a: string[]) => a.join(", ");

export function JobProfileForm({ initial, aiReady, adzunaReady }: { initial: JobProfileInput; aiReady: boolean; adzunaReady: boolean }) {
  const router = useRouter();
  const [saving, startSave] = useTransition();
  const [suggesting, startSuggest] = useTransition();
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const [f, setF] = useState({
    headline: initial.headline,
    resumeText: initial.resumeText,
    skills: fromList(initial.skills),
    roleKeywords: fromList(initial.roleKeywords),
    countries: initial.countries,
    greenhouseBoards: fromList(initial.greenhouseBoards),
    ashbyBoards: fromList(initial.ashbyBoards),
    leverBoards: fromList(initial.leverBoards),
    minSalaryUsd: initial.minSalaryUsd?.toString() ?? "",
    wantsRelocation: initial.wantsRelocation,
    entryLevelOnly: initial.entryLevelOnly,
    currentLocation: initial.currentLocation,
    preferredLocations: fromList(initial.preferredLocations),
    onlyPreferredLocations: initial.onlyPreferredLocations,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const suggest = () =>
    startSuggest(async () => {
      const res = await suggestProfileFromResume(f.resumeText);
      if (!res.ok || !res.data) return void toast.error(res.ok ? "No suggestions returned" : res.error);
      setF((x) => ({
        ...x,
        headline: res.data!.headline,
        skills: fromList(res.data!.skills),
        // Keep the user's keywords and add Claude's new ones.
        roleKeywords: fromList([...new Set([...toList(x.roleKeywords), ...res.data!.roleKeywords])]),
      }));
      toast.success(res.message);
    });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    startSave(async () => {
      const payload: JobProfileInput = {
        headline: f.headline,
        resumeText: f.resumeText,
        skills: toList(f.skills),
        roleKeywords: toList(f.roleKeywords),
        countries: f.countries,
        greenhouseBoards: toList(f.greenhouseBoards).map((s) => s.toLowerCase()),
        ashbyBoards: toList(f.ashbyBoards).map((s) => s.toLowerCase()),
        leverBoards: toList(f.leverBoards).map((s) => s.toLowerCase()),
        minSalaryUsd: f.minSalaryUsd ? Math.round(Number(f.minSalaryUsd)) : null,
        wantsRelocation: f.wantsRelocation,
        entryLevelOnly: f.entryLevelOnly,
        currentLocation: f.currentLocation,
        preferredLocations: toList(f.preferredLocations),
        onlyPreferredLocations: f.onlyPreferredLocations && toList(f.preferredLocations).length > 0,
      };
      const res = await saveJobProfile(payload);
      if (!res.ok) {
        setErrors(Object.fromEntries(Object.entries(res.fieldErrors ?? {}).map(([k, v]) => [k, v?.[0]])));
        return void toast.error(res.error);
      }
      setErrors({});
      toast.success(res.message);
      router.refresh();
    });
  };

  return (
    <form onSubmit={save} className="grid max-w-4xl gap-6" noValidate>
      <section className="space-y-4 rounded-xl border bg-card p-6" aria-labelledby="resume-h">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">You</p>
            <h2 id="resume-h" className="font-display text-xl font-semibold">Resume</h2>
            <p className="text-sm text-muted-foreground">Paste it as plain text. Claude drafts only from what’s here.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={suggest} loading={suggesting} disabled={!aiReady || f.resumeText.trim().length < 200}>
            {!suggesting && <Sparkles aria-hidden="true" />} Fill from resume with Claude
          </Button>
        </div>
        <FormField id="jp-resume" label="Resume text" error={errors.resumeText} hint={`${f.resumeText.length.toLocaleString()} / 30,000 characters`}>
          {(a) => <Textarea rows={12} value={f.resumeText} onChange={(e) => set("resumeText", e.target.value)} className="font-mono text-xs" {...a} />}
        </FormField>
        <FormField id="jp-headline" label="Headline" error={errors.headline}>
          {(a) => <Input maxLength={160} placeholder="e.g. CS graduate building with LLMs and RAG" value={f.headline} onChange={(e) => set("headline", e.target.value)} {...a} />}
        </FormField>
        <FormField id="jp-skills" label="Skills" hint="Comma or line separated. Used for scoring." error={errors.skills}>
          {(a) => <Textarea rows={2} value={f.skills} onChange={(e) => set("skills", e.target.value)} {...a} />}
        </FormField>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-6" aria-labelledby="target-h">
        <div>
          <p className="eyebrow">Target</p>
          <h2 id="target-h" className="font-display text-xl font-semibold">What to look for</h2>
        </div>
        <FormField id="jp-roles" label="Role keywords" hint="A posting must match at least one (title matches count most)." error={errors.roleKeywords}>
          {(a) => <Textarea rows={3} value={f.roleKeywords} onChange={(e) => set("roleKeywords", e.target.value)} {...a} />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField id="jp-salary" label="Minimum pay (USD / year)" hint="Optional. Unknown pay is never penalized." error={errors.minSalaryUsd}>
            {(a) => <Input type="number" min={0} step={1000} inputMode="numeric" value={f.minSalaryUsd} onChange={(e) => set("minSalaryUsd", e.target.value)} {...a} />}
          </FormField>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm sm:mt-7">
            <span>Prefer relocation / visa support</span>
            <Switch checked={f.wantsRelocation} onCheckedChange={(v) => set("wantsRelocation", v)} aria-label="Prefer relocation or visa support" />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm sm:mt-7">
            <span>Hide senior roles</span>
            <Switch checked={f.entryLevelOnly} onCheckedChange={(v) => set("entryLevelOnly", v)} aria-label="Hide senior roles" />
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-6" aria-labelledby="loc-h">
        <div>
          <p className="eyebrow">Location</p>
          <h2 id="loc-h" className="font-display text-xl font-semibold">Where you want to work</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField id="jp-current" label="Where you live now" error={errors.currentLocation}>
            {(a) => <Input maxLength={120} placeholder="e.g. Karachi, Pakistan" value={f.currentLocation} onChange={(e) => set("currentLocation", e.target.value)} {...a} />}
          </FormField>
          <FormField id="jp-places" label="Preferred locations" hint="Comma separated, e.g. Remote, UK, Germany" error={errors.preferredLocations}>
            {(a) => <Input value={f.preferredLocations} onChange={(e) => set("preferredLocations", e.target.value)} {...a} />}
          </FormField>
        </div>
        <label className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
          <span>Only show jobs in my preferred locations</span>
          <Switch checked={f.onlyPreferredLocations} onCheckedChange={(v) => set("onlyPreferredLocations", v)} aria-label="Only show jobs in preferred locations" />
        </label>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-6" aria-labelledby="sources-h">
        <div>
          <p className="eyebrow">Sources</p>
          <h2 id="sources-h" className="font-display text-xl font-semibold">Where to search</h2>
          <p className="text-sm text-muted-foreground">
            Remotive, Himalayas, Jobicy and Arbeitnow are always on. Company boards use the name from the careers URL
            (jobs.ashbyhq.com/<b>openai</b>, boards.greenhouse.io/<b>anthropic</b>, jobs.lever.co/<b>palantir</b>).
          </p>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">
            Adzuna countries {!adzunaReady && <span className="font-normal text-muted-foreground">(needs a free key in .env; skipped until then)</span>}
          </legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ADZUNA_COUNTRIES).map(([code, name]) => {
              const on = f.countries.includes(code);
              return (
                <label key={code} className={cn("cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring", on ? "border-primary bg-accent text-accent-foreground" : "hover:bg-muted")}>
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => set("countries", on ? f.countries.filter((c) => c !== code) : [...f.countries, code])} />
                  {name}
                </label>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-4 md:grid-cols-3">
          <FormField id="jp-gh" label="Greenhouse boards" error={errors.greenhouseBoards}>
            {(a) => <Textarea rows={6} className="font-mono text-xs" value={f.greenhouseBoards} onChange={(e) => set("greenhouseBoards", e.target.value)} {...a} />}
          </FormField>
          <FormField id="jp-ashby" label="Ashby boards" error={errors.ashbyBoards}>
            {(a) => <Textarea rows={6} className="font-mono text-xs" value={f.ashbyBoards} onChange={(e) => set("ashbyBoards", e.target.value)} {...a} />}
          </FormField>
          <FormField id="jp-lever" label="Lever boards" error={errors.leverBoards}>
            {(a) => <Textarea rows={6} className="font-mono text-xs" value={f.leverBoards} onChange={(e) => set("leverBoards", e.target.value)} {...a} />}
          </FormField>
        </div>
      </section>

      <div className="flex justify-end">
        <Button type="submit" loading={saving}>Save job profile</Button>
      </div>
    </form>
  );
}
