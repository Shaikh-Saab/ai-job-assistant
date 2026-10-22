"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";

import { signIn, signOut } from "@/auth";
import { enabledOAuthProviders, type OAuthProviderId } from "@/lib/auth-providers";
import { clearFailures, lockMessage, lockStatus } from "@/lib/auth/lockout";
import { prepareFirebaseReset } from "@/lib/auth/sign-in";
import { firebaseConfigured, firebaseRest, FirebaseRestError } from "@/lib/firebase/server";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken, hashToken } from "@/lib/tokens";
import { appUrl, emailConfigured, sendPasswordResetEmail } from "@/lib/mail";
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

  const { email } = parsed.data;
  const before = await lockStatus(email);
  if (before.locked) return { ok: false, error: lockMessage(before), code: "locked" };

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: safeRedirect(callbackUrl) });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type !== "CredentialsSignin") {
        return { ok: false, error: "We couldn’t sign you in just now. Please wait a moment and try again." };
      }
      const after = await lockStatus(email);
      return { ok: false, error: lockMessage(after), code: after.locked ? "locked" : "wrong" };
    }
    throw error; // the success path throws NEXT_REDIRECT, which must propagate
  }
}

/** Google/GitHub via Firebase: the browser sends the ID token from the pop-up. */
export async function firebaseSignIn(idToken: string, callbackUrl?: string | null): Promise<ActionResult> {
  if (!firebaseConfigured()) return { ok: false, error: "This sign-in method isn’t set up" };
  try {
    await signIn("firebase", { idToken, redirectTo: safeRedirect(callbackUrl) });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        error: "We couldn’t sign you in with that account. If you already have a password here, sign in with your email and password instead.",
      };
    }
    throw error;
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

  if (firebaseConfigured()) {
    // Firebase stores the password; we keep the profile and link the two.
    try {
      const { localId } = await firebaseRest.signUp(email, password);
      await prisma.user.create({ data: { name, email, firebaseUid: localId } });
    } catch (e) {
      if (e instanceof FirebaseRestError && e.code === "EMAIL_EXISTS") {
        return { ok: false, error: "An account with this email already exists", fieldErrors: { email: ["Already registered — try signing in"] } };
      }
      throw e;
    }
  } else {
    await prisma.user.create({
      data: { name, email, passwordHash: await bcrypt.hash(password, 12) },
    });
  }

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, error: "Account created — please sign in" };
    throw error;
  }
}

export async function oauthSignIn(provider: OAuthProviderId, callbackUrl?: string | null) {
  if (!enabledOAuthProviders().includes(provider)) throw new Error("This sign-in method isn't set up");
  await signIn(provider, { redirectTo: safeRedirect(callbackUrl) });
}

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

const RESET_SENT =
  "If there’s an account for that email, we’ve sent it a link to choose a new password. Please check your inbox (and the spam folder). The link works for 1 hour.";

export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid input", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  // Firebase writes and sends the reset email itself.
  if (firebaseConfigured()) {
    const email = parsed.data.email;
    try {
      await prepareFirebaseReset(email);
      await firebaseRest.sendPasswordReset(email, `${appUrl()}/login?reset=1`).catch(async (e) => {
        // The site's domain isn't on Firebase's list yet: still send, just without the "back to Nexus" link.
        if (e instanceof FirebaseRestError && e.code.startsWith("UNAUTHORIZED_DOMAIN")) return firebaseRest.sendPasswordReset(email);
        throw e;
      });
    } catch (e) {
      // EMAIL_NOT_FOUND: answer exactly as for a real account (no account fishing).
      if (!(e instanceof FirebaseRestError && e.code === "EMAIL_NOT_FOUND")) {
        console.error("[reset] firebase failed", e);
        return { ok: false, error: "We couldn’t send the email just now. Please try again in a minute." };
      }
    }
    return { ok: true, message: RESET_SENT };
  }

  // In production, never claim an email was sent when the site has no way to send one.
  if (process.env.NODE_ENV === "production" && !emailConfigured()) {
    return { ok: false, error: "Password reset by email isn’t set up on this site yet. Please contact the site owner." };
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
  await clearFailures(record.email); // they proved they own the inbox: lift any sign-in pause

  return { ok: true, message: "Password updated. You can sign in now." };
}
