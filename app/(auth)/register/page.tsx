import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { RegisterForm } from "@/components/auth/register-form";
import { bigLink } from "@/components/auth/sizes";
import { SocialSignIn } from "@/components/auth/social-sign-in";

// Reads email/OAuth/Firebase configuration at request time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <AuthCard
      eyebrow="New account"
      title="Create your account"
      description="It’s free and takes about a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className={bigLink}>
            Sign in
          </Link>
        </>
      }
    >
      <SocialSignIn dividerLabel="or sign up with your email" />
      <RegisterForm />
    </AuthCard>
  );
}
