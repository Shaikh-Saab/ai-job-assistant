"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useDebounce } from "@/hooks/use-debounce";
import { JOB_SOURCE_LABELS } from "@/lib/validations";

export function JobFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const debounced = useDebounce(q, 300);

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  useEffect(() => {
    if (debounced !== (params.get("q") ?? "")) set({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center" role="search">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <label htmlFor="job-search" className="sr-only">Search jobs</label>
        <Input id="job-search" type="search" placeholder="Title, company or country…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>
      <div className="grid grid-cols-3 gap-3 md:flex">
        <NativeSelect aria-label="Minimum match score" value={params.get("minScore") ?? ""} onChange={(e) => set({ minScore: e.target.value })} className="md:w-36">
          <option value="">Any score</option>
          <option value="60">60+</option>
          <option value="75">75+</option>
          <option value="90">90+</option>
        </NativeSelect>
        <NativeSelect aria-label="Source" value={params.get("source") ?? ""} onChange={(e) => set({ source: e.target.value })} className="md:w-40">
          <option value="">All sources</option>
          {Object.entries(JOB_SOURCE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Posted" value={params.get("week") ?? "1"} onChange={(e) => set({ week: e.target.value === "1" ? "" : e.target.value })} className="md:w-40">
          <option value="1">This week</option>
          <option value="0">Any time</option>
        </NativeSelect>
      </div>
    </div>
  );
}
