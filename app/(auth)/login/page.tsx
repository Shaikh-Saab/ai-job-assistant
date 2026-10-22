import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { FormAlert } from "@/components/auth/form-alert";
import { LoginForm } from "@/components/auth/login-form";
import { bigLink } from "@/components/auth/sizes";
import { SocialSignIn } from "@/components/auth/social-sign-in";

// Reads email/OAuth/Firebase configuration at request time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Sign in" };

const OAUTH_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: "This email is already registered with a different sign-in method. Please use that one.",
  AccessDenied: "Sign-in was cancelled. You can try again.",
  Configuration: "That sign-in method isn’t available right now. Please use your email and password instead.",
  CredentialsSignin: "That email and password don’t match. Please try again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; reset?: string }>;
}) {
  const { callbackUrl, error, reset } = await searchParams;

  return (
    <AuthCard
      eyebrow="Sign in"
      title="Welcome back"
      description="Sign in to see your jobs and applications."
      footer={
        <>
          New here?{" "}
          <Link href="/register" className={bigLink}>
            Create a free account
          </Link>
        </>
      }
    >
      {reset && <FormAlert tone="success">Your password has been changed. Please sign in with your new password.</FormAlert>}
      {error && <FormAlert>{OAUTH_ERRORS[error] ?? "Something went wrong. Please try again."}</FormAlert>}
      {process.env.NODE_ENV !== "production" && (
        <p className="rounded-md border border-dashed px-3 py-2 font-mono text-sm text-muted-foreground">
          Dev seed login: <span className="text-foreground">demo@nexus.dev</span> /{" "}
          <span className="text-foreground">Password123!</span>
        </p>
      )}
      <SocialSignIn callbackUrl={callbackUrl} />
      <LoginForm callbackUrl={callbackUrl} />
    </AuthCard>
  );
}
