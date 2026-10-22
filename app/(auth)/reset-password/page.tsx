import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { FormAlert } from "@/components/auth/form-alert";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { bigLink } from "@/components/auth/sizes";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthCard
      eyebrow="Account recovery"
      title="Set a new password"
      description="Choose a new password. Tip: a short sentence you’ll remember works well."
      footer={
        <Link href="/login" className={bigLink}>
          Back to sign in
        </Link>
      }
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <FormAlert
          action={
            <Link href="/forgot-password" className={bigLink}>
              Send me a new link
            </Link>
          }
        >
          This link isn’t complete. Please open the newest email from us, or ask for a new link.
        </FormAlert>
      )}
    </AuthCard>
  );
}
