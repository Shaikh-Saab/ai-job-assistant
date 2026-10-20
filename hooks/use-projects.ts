"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { createProject, deleteProject, updateProject } from "@/actions/projects";
import type { DashboardStats, ProjectPage } from "@/lib/data/projects";
import type { ProjectInput, ProjectQuery } from "@/lib/validations";
import type { ActionResult } from "@/types/actions";
import { queryKeys } from "@/hooks/query-keys";

export { queryKeys };

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (res.status === 401) {
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return res.json();
}

export function useProjects(q: Partial<ProjectQuery>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "") params.set(k, String(v));

  return useQuery({
    queryKey: queryKeys.projectList(q),
    queryFn: () => getJSON<ProjectPage>(`/api/projects?${params}`),
    placeholderData: keepPreviousData, // no flash of empty table while paging/filtering
  });
}

/** "Real-time" stats: polls every 15s and refetches on focus; mutations invalidate instantly. */
export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: () => getJSON<DashboardStats>("/api/stats"),
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}

/** Server actions return results rather than throwing; convert failures so React Query sees them. */
const unwrap = async <T,>(p: Promise<ActionResult<T>>) => {
  const res = await p;
  if (!res.ok) throw Object.assign(new Error(res.error), { fieldErrors: res.fieldErrors });
  return res;
};

function useInvalidate() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: queryKeys.projects }),
      qc.invalidateQueries({ queryKey: queryKeys.stats }),
    ]);
}

export function useSaveProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id?: string; input: ProjectInput }) =>
      unwrap(id ? updateProject(id, input) : createProject(input)),
    onSuccess: (res) => {
      toast.success(res.message ?? "Saved");
      return invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteProject() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) => unwrap(deleteProject(id)),
    onSuccess: (res) => {
      toast.success(res.message ?? "Deleted");
      return invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
