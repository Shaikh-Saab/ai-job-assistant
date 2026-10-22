"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { register as registerUser } from "@/actions/auth";
import { FormAlert } from "@/components/auth/form-alert";
import { PasswordChecklist } from "@/components/auth/password-checklist";
import { PasswordInput } from "@/components/auth/password-input";
import { bigButton, bigInput } from "@/components/auth/sizes";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
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
    watch,
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {formError && <FormAlert>{formError}</FormAlert>}
      <FormField id="name" label="Your name" size="lg" error={errors.name?.message}>
        {(aria) => <Input autoComplete="name" autoFocus className={bigInput} {...aria} {...register("name")} />}
      </FormField>
      <FormField id="email" label="Email address" size="lg" error={errors.email?.message}>
        {(aria) => (
          <Input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="name@example.com"
            className={bigInput}
            {...aria}
            {...register("email")}
          />
        )}
      </FormField>
      <FormField id="password" label="Choose a password" size="lg" error={errors.password?.message}>
        {(aria) => (
          <div className="space-y-3">
            <PasswordInput
              autoComplete="new-password"
              className={bigInput}
              {...aria}
              aria-describedby={[aria["aria-describedby"], "password-rules"].filter(Boolean).join(" ")}
              {...register("password")}
            />
            <PasswordChecklist id="password-rules" password={watch("password")} />
          </div>
        )}
      </FormField>
      <FormField id="confirmPassword" label="Type the password again" size="lg" error={errors.confirmPassword?.message}>
        {(aria) => <PasswordInput autoComplete="new-password" className={bigInput} {...aria} {...register("confirmPassword")} />}
      </FormField>
      <Button type="submit" className={bigButton} loading={pending}>
        {pending ? "Creating your account…" : "Create my account"}
      </Button>
    </form>
  );
}
