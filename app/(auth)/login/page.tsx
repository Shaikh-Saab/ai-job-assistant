import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

export const metadata: Metadata = { title: "Sign in" };

const OAUTH_ERRORS: Record<string, string> = {
  OAuthAccountNotLinked: "This email is already registered with a different sign-in method.",
  AccessDenied: "Access denied.",
  Configuration: "Sign-in is misconfigured. Please contact support.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;

  return (
    <AuthCard
      eyebrow="Sign in"
      title="Welcome back"
      description="Sign in to your account to continue."
      footer={
        <>
          No account?&nbsp;
          <Link href="/register" className="font-medium text-foreground underline-offset-4 hover:underline">
            Create one
          </Link>
        </>
      }
    >
      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {OAUTH_ERRORS[error] ?? "Something went wrong. Please try again."}
        </p>
      )}
      {process.env.NODE_ENV !== "production" && (
        <p className="rounded-md border border-dashed px-3 py-2 font-mono text-xs text-muted-foreground">
          Dev seed login: <span className="text-foreground">demo@nexus.dev</span> /{" "}
          <span className="text-foreground">Password123!</span>
        </p>
      )}
      <OAuthButtons callbackUrl={callbackUrl} />
      <Divider />
      <LoginForm callbackUrl={callbackUrl} />
    </AuthCard>
  );
}

function Divider() {
  return (
    <div className="relative text-center text-xs uppercase text-muted-foreground">
      <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden="true" />
      <span className="relative bg-card px-2">or continue with email</span>
    </div>
  );
}
