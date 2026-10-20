"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUIStore } from "@/store/ui-store";

export function NewProjectButton() {
  const openCreateProject = useUIStore((s) => s.openCreateProject);
  return (
    <Button onClick={openCreateProject}>
      <Plus aria-hidden="true" /> New project
    </Button>
  );
}
