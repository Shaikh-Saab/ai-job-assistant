"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { resetPassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { FormAlert } from "@/components/auth/form-alert";
import { PasswordChecklist } from "@/components/auth/password-checklist";
import { PasswordInput } from "@/components/auth/password-input";
import { bigButton, bigInput } from "@/components/auth/sizes";
import { applyFieldErrors } from "@/lib/form";
import { resetPasswordSchema } from "@/lib/validations";

type Values = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  const onSubmit = (values: Values) =>
    startTransition(async () => {
      const res = await resetPassword(values);
      if (res.ok) {
        router.push("/login?reset=1");
      } else {
        setFormError(res.error);
        applyFieldErrors(res, setError);
      }
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {formError && <FormAlert>{formError}</FormAlert>}
      <input type="hidden" {...register("token")} />
      <FormField id="password" label="New password" size="lg" error={errors.password?.message}>
        {(aria) => (
          <div className="space-y-3">
            <PasswordInput
              autoComplete="new-password"
              autoFocus
              className={bigInput}
              {...aria}
              aria-describedby={[aria["aria-describedby"], "password-rules"].filter(Boolean).join(" ")}
              {...register("password")}
            />
            <PasswordChecklist id="password-rules" password={watch("password")} />
          </div>
        )}
      </FormField>
      <FormField id="confirmPassword" label="Type the new password again" size="lg" error={errors.confirmPassword?.message}>
        {(aria) => <PasswordInput autoComplete="new-password" className={bigInput} {...aria} {...register("confirmPassword")} />}
      </FormField>
      <Button type="submit" className={bigButton} loading={pending}>
        Save my new password
      </Button>
    </form>
  );
}
