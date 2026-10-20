"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { useSaveProject } from "@/hooks/use-projects";
import type { ProjectDTO } from "@/lib/data/projects";
import { toDateInput } from "@/lib/utils";
import {
  PRIORITIES,
  PRIORITY_LABELS,
  PROJECT_STATUSES,
  STATUS_LABELS,
  projectSchema,
  type ProjectInput,
} from "@/lib/validations";

const EMPTY: ProjectInput = {
  name: "",
  description: "",
  status: "PLANNING",
  priority: "MEDIUM",
  budget: 0,
  progress: 0,
  dueDate: "",
};

const toValues = (p: ProjectDTO | null): ProjectInput =>
  p
    ? {
        name: p.name,
        description: p.description ?? "",
        status: p.status,
        priority: p.priority,
        budget: p.budget,
        progress: p.progress,
        dueDate: toDateInput(p.dueDate),
      }
    : EMPTY;

type Props = {
  open: boolean;
  project: ProjectDTO | null;
  onOpenChange: (open: boolean) => void;
};

export function ProjectFormDialog({ open, project, onOpenChange }: Props) {
  const save = useSaveProject();
  const isEdit = !!project;

  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors },
  } = useForm<ProjectInput>({ resolver: zodResolver(projectSchema), defaultValues: toValues(project) });

  // Re-seed the form whenever the dialog opens for a different project.
  useEffect(() => {
    if (open) reset(toValues(project));
  }, [open, project, reset]);

  const status = watch("status");

  const onSubmit = (input: ProjectInput) =>
    save.mutate(
      { id: project?.id, input },
      {
        onSuccess: () => onOpenChange(false),
        onError: (e) => {
          const fieldErrors = (e as Error & { fieldErrors?: Record<string, string[]> }).fieldErrors ?? {};
          for (const [field, msgs] of Object.entries(fieldErrors)) {
            if (msgs?.[0]) setError(field as keyof ProjectInput, { type: "server", message: msgs[0] });
          }
        },
      },
    );

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update the details and save your changes." : "Fill in the details to create a project."}
          </DialogDescription>
        </DialogHeader>

        <form id="project-form" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField id="name" label="Name" error={errors.name?.message} className="sm:col-span-2">
            {(aria) => <Input autoFocus maxLength={100} {...aria} {...register("name")} />}
          </FormField>

          <FormField id="description" label="Description" error={errors.description?.message} className="sm:col-span-2">
            {(aria) => <Textarea rows={3} maxLength={500} {...aria} {...register("description")} />}
          </FormField>

          <FormField id="status" label="Status" error={errors.status?.message}>
            {(aria) => (
              <NativeSelect {...aria} {...register("status")}>
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>

          <FormField id="priority" label="Priority" error={errors.priority?.message}>
            {(aria) => (
              <NativeSelect {...aria} {...register("priority")}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABELS[p]}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>

          <FormField id="budget" label="Budget (USD)" error={errors.budget?.message}>
            {(aria) => (
              <Input type="number" inputMode="numeric" min={0} step={1} {...aria} {...register("budget", { valueAsNumber: true })} />
            )}
          </FormField>

          <FormField
            id="progress"
            label="Progress (%)"
            error={errors.progress?.message}
            hint={status === "COMPLETED" ? "Completed projects are saved at 100%." : undefined}
          >
            {(aria) => (
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                // readOnly, not disabled: RHF drops disabled fields' values, which would fail validation.
                readOnly={status === "COMPLETED"}
                className={status === "COMPLETED" ? "opacity-60" : undefined}
                {...aria}
                {...register("progress", { valueAsNumber: true })}
              />
            )}
          </FormField>

          <FormField id="dueDate" label="Due date" error={errors.dueDate?.message} className="sm:col-span-2">
            {(aria) => <Input type="date" {...aria} {...register("dueDate")} />}
          </FormField>
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="project-form" loading={save.isPending}>
            {isEdit ? "Save changes" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
