"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { saveLocationPreferences } from "@/actions/jobs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { LocationPrefsInput } from "@/lib/validations";

const SUGGESTIONS = ["Remote", "UK", "Germany", "Netherlands", "Ireland", "Canada", "USA", "UAE", "Singapore", "Australia"];

/** Where the user lives and where they want to work. Used by job search ranking and Claude drafts. */
export function LocationForm({ initial }: { initial: LocationPrefsInput }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState(initial.currentLocation);
  const [places, setPlaces] = useState<string[]>(initial.preferredLocations);
  const [draft, setDraft] = useState("");
  const [onlyThese, setOnlyThese] = useState(initial.onlyPreferredLocations);
  const [relocate, setRelocate] = useState(initial.wantsRelocation);

  const add = (value: string) => {
    const v = value.trim();
    if (!v) return;
    if (places.some((p) => p.toLowerCase() === v.toLowerCase())) return setDraft("");
    if (places.length >= 30) return void toast.error("Up to 30 locations");
    setPlaces([...places, v]);
    setDraft("");
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await saveLocationPreferences({
        currentLocation: current,
        preferredLocations: places,
        onlyPreferredLocations: onlyThese && places.length > 0,
        wantsRelocation: relocate,
      });
      if (!res.ok) return void toast.error(res.error);
      toast.success(res.message);
      router.refresh();
    });
  };

  return (
    <Card>
      <form onSubmit={save} noValidate>
        <CardHeader>
          <CardTitle as="h2" className="flex items-center gap-2">
            <MapPin className="h-5 w-5" aria-hidden="true" /> Location
          </CardTitle>
          <CardDescription>Where you are and where you want to work. Job search ranks matching postings higher.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <FormField id="loc-current" label="Where do you live now?" hint="Used in drafts, e.g. for relocation and work-authorization answers.">
            {(a) => <Input placeholder="e.g. Karachi, Pakistan" maxLength={120} value={current} onChange={(e) => setCurrent(e.target.value)} {...a} />}
          </FormField>

          <div className="space-y-2">
            <label htmlFor="loc-add" className="text-sm font-medium">Preferred locations</label>
            {places.length > 0 && (
              <ul className="flex flex-wrap gap-2" aria-label="Preferred locations">
                {places.map((p) => (
                  <li key={p} className="flex items-center gap-1 rounded-full border bg-accent px-3 py-1 text-xs text-accent-foreground">
                    {p}
                    <button type="button" onClick={() => setPlaces(places.filter((x) => x !== p))} className="rounded-full p-0.5 hover:bg-background" aria-label={`Remove ${p}`}>
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-2">
              <Input
                id="loc-add"
                placeholder="City, country or Remote"
                value={draft}
                maxLength={60}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    add(draft);
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={() => add(draft)} aria-label="Add location">
                <Plus aria-hidden="true" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5" aria-label="Suggestions">
              {SUGGESTIONS.filter((s) => !places.some((p) => p.toLowerCase() === s.toLowerCase())).map((s) => (
                <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-dashed px-2.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
                  + {s}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm">
            <span>
              <span className="block font-medium">Only show jobs in these locations</span>
              <span className="text-muted-foreground">Off: matching jobs rank higher, others still appear.</span>
            </span>
            <Switch checked={onlyThese} disabled={places.length === 0} onCheckedChange={setOnlyThese} aria-label="Only show jobs in preferred locations" />
          </label>

          <label className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm">
            <span>
              <span className="block font-medium">Open to relocating</span>
              <span className="text-muted-foreground">Ranks jobs offering relocation or visa support higher.</span>
            </span>
            <Switch checked={relocate} onCheckedChange={setRelocate} aria-label="Open to relocating" />
          </label>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" loading={pending}>Save location</Button>
        </CardFooter>
      </form>
    </Card>
  );
}
