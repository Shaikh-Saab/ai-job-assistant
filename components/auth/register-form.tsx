"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { register as registerUser } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { applyFieldErrors } from "@/lib/form";
import { registerSchema } from "@/lib/validations";

type Values = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" },
  });

  const onSubmit = (values: Values) => {
    setFormError(null);
    startTransition(async () => {
      const res = await registerUser(values);
      if (res && !res.ok) {
        setFormError(res.error);
        applyFieldErrors(res, setError);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {formError && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}
      <FormField id="name" label="Full name" error={errors.name?.message}>
        {(aria) => <Input autoComplete="name" {...aria} {...register("name")} />}
      </FormField>
      <FormField id="email" label="Email" error={errors.email?.message}>
        {(aria) => <Input type="email" autoComplete="email" {...aria} {...register("email")} />}
      </FormField>
      <FormField
        id="password"
        label="Password"
        error={errors.password?.message}
        hint="8+ characters with upper & lowercase letters and a number."
      >
        {(aria) => <PasswordInput autoComplete="new-password" {...aria} {...register("password")} />}
      </FormField>
      <FormField id="confirmPassword" label="Confirm password" error={errors.confirmPassword?.message}>
        {(aria) => <PasswordInput autoComplete="new-password" {...aria} {...register("confirmPassword")} />}
      </FormField>
      <Button type="submit" className="w-full" loading={pending}>
        Create account
      </Button>
    </form>
  );
}
