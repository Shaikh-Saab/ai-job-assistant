import { create } from "zustand";
import type { ProjectDTO } from "@/lib/data/projects";

/** Client-only UI state shared across distant components (sidebar, header, table, dialogs). */
type UIState = {
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;

  /** null = closed; { project: null } = create; { project } = edit */
  projectDialog: { project: ProjectDTO | null } | null;
  openCreateProject: () => void;
  openEditProject: (project: ProjectDTO) => void;
  closeProjectDialog: () => void;

  deleteTarget: ProjectDTO | null;
  setDeleteTarget: (project: ProjectDTO | null) => void;
};

export const useUIStore = create<UIState>((set) => ({
  mobileNavOpen: false,
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),

  projectDialog: null,
  openCreateProject: () => set({ projectDialog: { project: null } }),
  openEditProject: (project) => set({ projectDialog: { project } }),
  closeProjectDialog: () => set({ projectDialog: null }),

  deleteTarget: null,
  setDeleteTarget: (deleteTarget) => set({ deleteTarget }),
}));
