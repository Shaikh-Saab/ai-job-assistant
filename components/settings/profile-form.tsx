"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";

import { updateProfile } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { applyFieldErrors } from "@/lib/form";
import { profileSchema } from "@/lib/validations";

type Values = z.infer<typeof profileSchema>;

export function ProfileForm({ defaultValues, email }: { defaultValues: Values; email: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { errors, isDirty },
  } = useForm<Values>({ resolver: zodResolver(profileSchema), defaultValues });

  const bioLength = watch("bio")?.length ?? 0;

  const onSubmit = (values: Values) =>
    startTransition(async () => {
      const res = await updateProfile(values);
      if (res.ok) {
        toast.success(res.message);
        reset(values); // new baseline → isDirty false
        router.refresh();
      } else {
        toast.error(res.error);
        applyFieldErrors(res, setError);
      }
    });

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardHeader>
          <CardTitle as="h2">Profile</CardTitle>
          <CardDescription>This is how you appear across Nexus.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField id="profile-email" label="Email" hint="Email changes aren’t supported yet.">
            {(aria) => <Input value={email} readOnly disabled {...aria} />}
          </FormField>
          <FormField id="profile-name" label="Name" error={errors.name?.message}>
            {(aria) => <Input autoComplete="name" {...aria} {...register("name")} />}
          </FormField>
          <FormField id="profile-bio" label="Bio" error={errors.bio?.message} hint={`${bioLength}/280`}>
            {(aria) => <Textarea rows={4} maxLength={280} placeholder="A sentence or two about you" {...aria} {...register("bio")} />}
          </FormField>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" loading={pending} disabled={!isDirty}>
            Save profile
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
