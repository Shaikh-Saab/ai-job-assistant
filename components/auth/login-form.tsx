"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { login } from "@/actions/auth";
import { FormAlert } from "@/components/auth/form-alert";
import { PasswordInput } from "@/components/auth/password-input";
import { bigButton, bigInput, bigLink } from "@/components/auth/sizes";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { loginSchema } from "@/lib/validations";

type Values = z.infer<typeof loginSchema>;

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<{ message: string; locked: boolean } | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = (values: Values) => {
    setFailure(null);
    startTransition(async () => {
      const res = await login(values, callbackUrl);
      if (res && !res.ok) {
        // success redirects server-side
        setFailure({ message: res.error, locked: res.code === "locked" });
        setValue("password", "");
        if (res.code !== "locked") setFocus("password");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {failure && (
        <FormAlert
          action={
            failure.locked ? (
              <Button asChild variant="outline" className="h-12 text-base">
                <Link href="/forgot-password">Reset my password</Link>
              </Button>
            ) : undefined
          }
        >
          {failure.message}
        </FormAlert>
      )}
      <FormField id="email" label="Email address" size="lg" error={errors.email?.message}>
        {(aria) => (
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            placeholder="name@example.com"
            className={bigInput}
            {...aria}
            {...register("email")}
          />
        )}
      </FormField>
      <FormField id="password" label="Password" size="lg" error={errors.password?.message}>
        {(aria) => <PasswordInput autoComplete="current-password" className={bigInput} {...aria} {...register("password")} />}
      </FormField>
      <Button type="submit" className={bigButton} loading={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center">
        <Link href="/forgot-password" className={bigLink}>
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}
