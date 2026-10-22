import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { RegisterForm } from "@/components/auth/register-form";
import { enabledOAuthProviders } from "@/lib/auth-providers";

// Reads email/OAuth configuration at request time.
export const dynamic = "force-dynamic";

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
      <OAuthButtons providers={enabledOAuthProviders()} dividerLabel="or sign up with email" />
      <RegisterForm />
    </AuthCard>
  );
}
