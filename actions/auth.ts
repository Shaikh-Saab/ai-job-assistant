"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken, hashToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/mail";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validations";
import type { ActionResult } from "@/types/actions";

/**
 * Middleware sends an absolute callbackUrl; keep only its path + query so the redirect
 * always stays on this origin (blocks open redirects like //evil.com or https://evil.com).
 */
function safeRedirect(url?: string | null) {
  if (!url) return "/dashboard";
  try {
    const { pathname, search } = new URL(url, "http://localhost");
    return pathname.startsWith("/") && !pathname.startsWith("//") ? pathname + search : "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export async function login(input: unknown, callbackUrl?: string | null): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: safeRedirect(callbackUrl) });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        error: error.type === "CredentialsSignin" ? "Invalid email or password" : "Could not sign in",
      };
    }
    throw error; // the success path throws NEXT_REDIRECT, which must propagate
  }
}

export async function register(input: unknown): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return { ok: false, error: "An account with this email already exists", fieldErrors: { email: ["Already registered"] } };
  }

  await prisma.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 12) },
  });

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: "Account created — please sign in" };
    throw error;
  }
}

export async function oauthSignIn(provider: "github" | "google", callbackUrl?: string | null) {
  if (provider !== "github" && provider !== "google") throw new Error("Unknown provider");
  await signIn(provider, { redirectTo: safeRedirect(callbackUrl) });
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

const RESET_SENT =
  "If an account exists for that email, a reset link is on its way. It expires in 1 hour.";

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { email: true },
  });

  // Same response whether or not the account exists (prevents email enumeration).
  if (user) {
    try {
      const token = await createPasswordResetToken(user.email);
      await sendPasswordResetEmail(user.email, token);
    } catch (e) {
      console.error("[reset] failed", e);
      return { ok: false, error: "Could not send the email. Please try again." };
    }
  }

  return { ok: true, message: RESET_SENT };
}

export async function resetPassword(input: unknown): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
  });
  if (!record || record.expires < new Date()) {
    return { ok: false, error: "This reset link is invalid or has expired." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { email: record.email }, data: { passwordHash } }),
    prisma.passwordResetToken.deleteMany({ where: { email: record.email } }),
  ]);

  return { ok: true, message: "Password updated. You can sign in now." };
}
