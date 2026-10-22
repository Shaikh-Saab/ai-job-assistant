import "server-only";
import nodemailer from "nodemailer";

/**
 * Public base URL for links in emails. On Vercel, VERCEL_URL is the per-deployment address,
 * which sits behind Vercel's login, so the production domain is preferred.
 */
export const appUrl = () =>
  process.env.NEXT_PUBLIC_APP_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) ||
  process.env.RENDER_EXTERNAL_URL || // set automatically on Render
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

const smtpConfigured = () => !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
const resendConfigured = () => !!process.env.RESEND_API_KEY;

/** True when the site can actually deliver email (SMTP such as Gmail/Brevo, or Resend). */
export const emailConfigured = () => smtpConfigured() || resendConfigured();

const fromAddress = () => process.env.EMAIL_FROM || process.env.SMTP_USER || "Nexus <onboarding@resend.dev>";

type Mail = { to: string; subject: string; html: string; text: string };

async function send(mail: Mail) {
  if (smtpConfigured()) {
    const port = Number(process.env.SMTP_PORT || 465);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // 465 = TLS from the start; 587 upgrades with STARTTLS
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transport.sendMail({ from: fromAddress(), ...mail });
    return;
  }

  if (resendConfigured()) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: fromAddress(), ...mail }),
    });
    if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
    return;
  }

  // Development fallback: no provider configured, so print the email instead of sending it.
  console.info(`[mail] (not sent, no email provider configured) To: ${mail.to}\n${mail.text}`);
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const link = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  await send({
    to,
    subject: "Reset your Nexus password",
    text: `Someone asked to reset the password for your Nexus account.\n\nReset it here (the link expires in 1 hour):\n${link}\n\nIf this wasn't you, ignore this email. Your password won't change.`,
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:480px;margin:auto;padding:24px;color:#0e1726">
  <p style="font-size:12px;letter-spacing:2px;color:#5b6472">NEXUS</p>
  <h1 style="font-size:20px;margin:8px 0 16px">Reset your password</h1>
  <p>Someone asked to reset the password for your Nexus account.</p>
  <p style="margin:24px 0"><a href="${link}" style="background:#2453d6;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600">Choose a new password</a></p>
  <p style="font-size:13px;color:#5b6472">The link expires in 1 hour. If this wasn't you, ignore this email; your password won't change.</p>
  <p style="font-size:12px;color:#5b6472;word-break:break-all">${link}</p>
</div>`,
  });
}
