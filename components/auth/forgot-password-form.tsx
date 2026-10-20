"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";

import { requestPasswordReset } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { forgotPasswordSchema } from "@/lib/validations";

type Values = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  const onSubmit = (values: Values) =>
    startTransition(async () => {
      const res = await requestPasswordReset(values);
      if (res.ok) setSent(res.message ?? "Check your inbox.");
      else toast.error(res.error);
    });

  if (sent) {
    return (
      <div role="status" className="flex gap-3 rounded-md border bg-muted/50 p-4 text-sm">
        <MailCheck className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <p>{sent}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <FormField id="email" label="Email" error={errors.email?.message}>
        {(aria) => <Input type="email" autoComplete="email" {...aria} {...register("email")} />}
      </FormField>
      <Button type="submit" className="w-full" loading={pending}>
        Send reset link
      </Button>
    </form>
  );
}
