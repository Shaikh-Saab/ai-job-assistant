import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { emailConfigured } from "@/lib/mail";

// Reads email/OAuth configuration at request time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      eyebrow="Account recovery"
      title="Forgot your password?"
      description="Enter your email and we’ll send you a reset link."
      footer={
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {process.env.NODE_ENV === "production" && !emailConfigured() ? (
        <p role="status" className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
          Password reset by email isn’t set up on this site yet. Please contact the site owner to reset your password.
        </p>
      ) : (
        <ForgotPasswordForm />
      )}
    </AuthCard>
  );
}
