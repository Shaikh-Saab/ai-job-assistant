"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import type { z } from "zod";

import { resetPassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { PasswordInput } from "@/components/auth/password-input";
import { applyFieldErrors } from "@/lib/form";
import { resetPasswordSchema } from "@/lib/validations";

type Values = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  const onSubmit = (values: Values) =>
    startTransition(async () => {
      const res = await resetPassword(values);
      if (res.ok) {
        toast.success(res.message);
        router.push("/login");
      } else {
        toast.error(res.error);
        applyFieldErrors(res, setError);
      }
    });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <input type="hidden" {...register("token")} />
      <FormField
        id="password"
        label="New password"
        error={errors.password?.message}
        hint="8+ characters with upper & lowercase letters and a number."
      >
        {(aria) => <PasswordInput autoComplete="new-password" {...aria} {...register("password")} />}
      </FormField>
      <FormField id="confirmPassword" label="Confirm new password" error={errors.confirmPassword?.message}>
        {(aria) => <PasswordInput autoComplete="new-password" {...aria} {...register("confirmPassword")} />}
      </FormField>
      <Button type="submit" className="w-full" loading={pending}>
        Update password
      </Button>
    </form>
  );
}
