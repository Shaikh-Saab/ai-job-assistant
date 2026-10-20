import "server-only";

export const appUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

/** Sends via Resend's REST API when configured; otherwise logs (useful in development). */
export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;

  if (!process.env.RESEND_API_KEY) {
    console.info(`[mail] Password reset link for ${to}: ${link}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Nexus <onboarding@resend.dev>",
      to,
      subject: "Reset your Nexus password",
      html: `<p>Someone requested a password reset for your Nexus account.</p>
<p><a href="${link}">Reset your password</a> — this link expires in 1 hour.</p>
<p>If this wasn't you, you can ignore this email.</p>`,
    }),
  });

  if (!res.ok) {
    console.error("[mail] Resend error", res.status, await res.text());
    throw new Error("Failed to send email");
  }
}
