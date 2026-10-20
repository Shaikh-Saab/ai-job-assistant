import type { ProjectQuery } from "@/lib/validations";

// Kept separate from the hooks so server components can import it without "use client".
export const queryKeys = {
  projects: ["projects"] as const,
  projectList: (q: Partial<ProjectQuery>) => ["projects", "list", q] as const,
  stats: ["stats"] as const,
};
