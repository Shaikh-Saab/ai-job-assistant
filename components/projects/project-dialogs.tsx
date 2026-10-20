"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ProjectFormDialog } from "@/components/projects/project-form-dialog";
import { useDeleteProject } from "@/hooks/use-projects";
import { useUIStore } from "@/store/ui-store";

/** Mounted once in the dashboard layout so any page can open create/edit/delete via the store. */
export function ProjectDialogs() {
  const projectDialog = useUIStore((s) => s.projectDialog);
  const closeProjectDialog = useUIStore((s) => s.closeProjectDialog);
  const deleteTarget = useUIStore((s) => s.deleteTarget);
  const setDeleteTarget = useUIStore((s) => s.setDeleteTarget);
  const del = useDeleteProject();

  return (
    <>
      <ProjectFormDialog
        open={!!projectDialog}
        project={projectDialog?.project ?? null}
        onOpenChange={(open) => !open && closeProjectDialog()}
      />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && !del.isPending && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              “{deleteTarget?.name}” will be permanently deleted. This can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
            {/* A plain Button (not AlertDialogAction) so the dialog stays open until the delete finishes. */}
            <Button
              variant="destructive"
              loading={del.isPending}
              onClick={() =>
                deleteTarget && del.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
              }
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
