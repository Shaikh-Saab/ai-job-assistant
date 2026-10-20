import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <AuthCard
      eyebrow="New workspace"
      title="Create your account"
      description="Start tracking your projects in under a minute."
      footer={
        <>
          Already have an account?&nbsp;
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <OAuthButtons />
      <div className="relative text-center text-xs uppercase text-muted-foreground">
        <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden="true" />
        <span className="relative bg-card px-2">or sign up with email</span>
      </div>
      <RegisterForm />
    </AuthCard>
  );
}
