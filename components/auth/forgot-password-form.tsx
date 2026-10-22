"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";

import { requestPasswordReset } from "@/actions/auth";
import { FormAlert } from "@/components/auth/form-alert";
import { bigButton, bigInput, bigLink } from "@/components/auth/sizes";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { forgotPasswordSchema } from "@/lib/validations";

type Values = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  const onSubmit = (values: Values) =>
    startTransition(async () => {
      setFormError(null);
      const res = await requestPasswordReset(values);
      if (res.ok) setSent(res.message ?? "Check your inbox.");
      else setFormError(res.error);
    });

  if (sent) {
    return (
      <div className="space-y-6">
        <FormAlert tone="success">{sent}</FormAlert>
        <ol className="list-decimal space-y-2 pl-6 text-base leading-relaxed">
          <li>Open the email from Nexus (it can take a few minutes).</li>
          <li>Press the link inside it.</li>
          <li>Choose a new password, then come back and sign in.</li>
        </ol>
        <Button asChild variant="outline" className={bigButton}>
          <Link href="/login">Back to sign in</Link>
        </Button>
        <p className="text-center text-base">
          No email?{" "}
          <button type="button" className={bigLink} onClick={() => setSent(null)}>
            Send it again
          </button>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
      {formError && <FormAlert>{formError}</FormAlert>}
      <FormField id="email" label="Email address" size="lg" error={errors.email?.message} hint="The one you use to sign in.">
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
      <Button type="submit" className={bigButton} loading={pending}>
        {pending ? "Sending…" : "Email me a reset link"}
      </Button>
    </form>
  );
}
