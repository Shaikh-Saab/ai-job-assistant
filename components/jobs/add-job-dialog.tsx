"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link2 } from "lucide-react";
import { toast } from "sonner";

import { addManualJob } from "@/actions/jobs";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applyFieldErrors } from "@/lib/form";
import { manualJobSchema, type ManualJobInput } from "@/lib/validations";

/** For LinkedIn and anything else without an API: paste the link and copy the description in. */
export function AddJobDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, reset, setError, formState: { errors } } = useForm<ManualJobInput>({
    resolver: zodResolver(manualJobSchema),
    defaultValues: { url: "", title: "", company: "", location: "", description: "" },
  });

  const onSubmit = (values: ManualJobInput) =>
    startTransition(async () => {
      const res = await addManualJob(values);
      if (!res.ok) {
        toast.error(res.error);
        return applyFieldErrors(res, setError);
      }
      toast.success(res.message);
      reset();
      setOpen(false);
      if (res.data) router.push(`/jobs/${res.data.id}`);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Link2 aria-hidden="true" /> Add a job link
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a job you found</DialogTitle>
          <DialogDescription>
            Use this for LinkedIn or any other site. Paste the link and copy the job description in. Nexus doesn’t visit the page.
          </DialogDescription>
        </DialogHeader>
        <form id="add-job" onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2" noValidate>
          <FormField id="aj-url" label="Job link" error={errors.url?.message} className="sm:col-span-2">
            {(a) => <Input type="url" placeholder="https://www.linkedin.com/jobs/view/…" autoFocus {...a} {...register("url")} />}
          </FormField>
          <FormField id="aj-title" label="Job title" error={errors.title?.message}>
            {(a) => <Input {...a} {...register("title")} />}
          </FormField>
          <FormField id="aj-company" label="Company" error={errors.company?.message}>
            {(a) => <Input {...a} {...register("company")} />}
          </FormField>
          <FormField id="aj-location" label="Location" error={errors.location?.message} className="sm:col-span-2">
            {(a) => <Input placeholder="e.g. Berlin, Germany (relocation offered)" {...a} {...register("location")} />}
          </FormField>
          <FormField
            id="aj-desc"
            label="Job description"
            hint="Paste the full text. Claude uses it to score your fit and draft answers."
            error={errors.description?.message}
            className="sm:col-span-2"
          >
            {(a) => <Textarea rows={7} {...a} {...register("description")} />}
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" form="add-job" loading={pending}>Add to shortlist</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
