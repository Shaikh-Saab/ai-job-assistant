import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { bigLink } from "@/components/auth/sizes";
import { firebaseConfigured } from "@/lib/firebase/server";
import { emailConfigured } from "@/lib/mail";

// Reads email/OAuth configuration at request time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      eyebrow="Account recovery"
      title="Forgot your password?"
      description="No problem. Type your email address and we’ll send you a link to choose a new one."
      footer={
        <Link href="/login" className={bigLink}>
          Back to sign in
        </Link>
      }
    >
      {process.env.NODE_ENV === "production" && !firebaseConfigured() && !emailConfigured() ? (
        <p role="status" className="rounded-md border border-dashed px-4 py-4 text-base leading-relaxed text-muted-foreground">
          Password reset by email isn’t set up on this site yet. Please contact the site owner to reset your password.
        </p>
      ) : (
        <ForgotPasswordForm />
      )}
    </AuthCard>
  );
}
