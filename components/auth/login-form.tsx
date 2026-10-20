"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { login } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { loginSchema } from "@/lib/validations";

type Values = z.infer<typeof loginSchema>;

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = (values: Values) => {
    setFormError(null);
    startTransition(async () => {
      const res = await login(values, callbackUrl);
      if (res && !res.ok) setFormError(res.error); // success redirects server-side
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {formError && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {formError}
        </p>
      )}
      <FormField id="email" label="Email" error={errors.email?.message}>
        {(aria) => <Input type="email" autoComplete="email" placeholder="you@example.com" {...aria} {...register("email")} />}
      </FormField>
      <FormField
        id="password"
        label="Password"
        error={errors.password?.message}
        labelAction={
          <Link href="/forgot-password" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
            Forgot password?
          </Link>
        }
      >
        {(aria) => <PasswordInput autoComplete="current-password" {...aria} {...register("password")} />}
      </FormField>
      <Button type="submit" className="w-full" loading={pending}>
        Sign in
      </Button>
    </form>
  );
}
