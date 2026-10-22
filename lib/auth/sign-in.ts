import "server-only";
import bcrypt from "bcryptjs";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { User } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { clearFailures, lockStatus, recordFailure } from "@/lib/auth/lockout";
import { adminAuth, firebaseConfigured, firebaseRest, FirebaseRestError, WRONG_CREDENTIALS } from "@/lib/firebase/server";

export type SessionUser = Pick<User, "id" | "name" | "email" | "image">;
const toSession = ({ id, name, email, image }: User): SessionUser => ({ id, name, email, image });

/**
 * Email + password sign-in, used by the Credentials provider (so it also guards direct POSTs
 * to /api/auth/callback/credentials). Checks the wrong-password pause first, then the password
 * with Firebase when it's configured, or against the local bcrypt hash otherwise.
 */
export async function passwordSignIn(email: string, password: string): Promise<SessionUser | null> {
  if ((await lockStatus(email)).locked) return null;

  const user = firebaseConfigured() ? await viaFirebase(email, password) : await viaDatabase(email, password);
  if (user) {
    await clearFailures(email);
    return toSession(user);
  }
  await recordFailure(email);
  return null;
}

async function viaDatabase(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) return null; // Google/GitHub-only account or unknown email
  return (await bcrypt.compare(password, user.passwordHash)) ? user : null;
}

async function viaFirebase(email: string, password: string) {
  try {
    const { idToken } = await firebaseRest.signInWithPassword(email, password);
    const user = await userFromFirebase(await adminAuth().verifyIdToken(idToken));
    // Firebase now holds the password; retire the old local copy.
    return user?.passwordHash ? prisma.user.update({ where: { id: user.id }, data: { passwordHash: null } }) : user;
  } catch (e) {
    if (!(e instanceof FirebaseRestError && WRONG_CREDENTIALS.has(e.code))) throw e; // outage → "try again"
  }

  // Accounts made before Firebase was switched on still have a local password. If it matches,
  // move the account to Firebase with that same password – the person notices nothing.
  const legacy = await prisma.user.findUnique({ where: { email } });
  if (!legacy?.passwordHash || !(await bcrypt.compare(password, legacy.passwordHash))) return null;

  const auth = adminAuth();
  let uid = legacy.firebaseUid;
  if (uid) {
    // Linked by a reset request. If a Firebase password was set since, that one wins.
    const record = await auth.getUser(uid);
    if (record.providerData.some((p) => p.providerId === "password")) return null;
    await auth.updateUser(uid, { password });
  } else {
    uid = await firebaseAccountFor(email, password);
  }
  return prisma.user.update({ where: { id: legacy.id }, data: { firebaseUid: uid, passwordHash: null } });
}

/** Create the Firebase account for an email, or take over one with that email (the local password was just proven). */
async function firebaseAccountFor(email: string, password: string) {
  const auth = adminAuth();
  try {
    return (await auth.createUser({ email, password })).uid;
  } catch (e) {
    if ((e as { code?: string }).code !== "auth/email-already-exists") throw e;
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, { password });
    return existing.uid;
  }
}

/**
 * Find or create the local user for a verified Firebase ID token.
 * An existing local account is only joined when Firebase has confirmed the person owns the email
 * (Google always does); otherwise someone could register that email in Firebase first and walk
 * into another person's account.
 */
export async function userFromFirebase(token: DecodedIdToken) {
  const email = token.email?.trim().toLowerCase();
  if (!email) return null;

  const linked = await prisma.user.findUnique({ where: { firebaseUid: token.uid } });
  if (linked) return linked;

  const local = await prisma.user.findUnique({ where: { email } });
  if (local) {
    if (local.firebaseUid) return null; // tied to a different Firebase account
    if (!token.email_verified) return null;
    return prisma.user.update({
      where: { id: local.id },
      data: { firebaseUid: token.uid, emailVerified: local.emailVerified ?? new Date() },
    });
  }

  return prisma.user.create({
    data: {
      email,
      firebaseUid: token.uid,
      name: typeof token.name === "string" ? token.name : null,
      image: typeof token.picture === "string" ? token.picture : null,
      emailVerified: token.email_verified ? new Date() : null,
    },
  });
}

/** Google/GitHub pop-up sign-in: the browser hands us a fresh Firebase ID token. */
export async function firebaseTokenSignIn(idToken: string): Promise<SessionUser | null> {
  if (!firebaseConfigured() || !idToken) return null;
  let token: DecodedIdToken;
  try {
    token = await adminAuth().verifyIdToken(idToken, true); // signature, expiry, revocation
  } catch {
    return null;
  }
  // Only accept sign-ins from the last few minutes, so an old token can't be replayed.
  if (Date.now() / 1000 - token.auth_time > 5 * 60) return null;
  const user = await userFromFirebase(token);
  return user && toSession(user);
}

/**
 * Before Firebase sends a reset email, make sure an older local account exists in Firebase
 * (with no password yet) and is linked, so the new password works on the way back.
 * The local password is kept: a stranger requesting a reset must not lock the owner out.
 */
export async function prepareFirebaseReset(email: string) {
  const local = await prisma.user.findUnique({ where: { email }, select: { id: true, firebaseUid: true } });
  if (!local || local.firebaseUid) return;
  const auth = adminAuth();
  try {
    const { uid } = await auth.createUser({ email });
    await prisma.user.update({ where: { id: local.id }, data: { firebaseUid: uid } });
  } catch (e) {
    // Someone else already made a Firebase account with this email: don't link it here.
    // Firebase still emails the real inbox owner; signing in then links once the email is verified.
    if ((e as { code?: string }).code !== "auth/email-already-exists") throw e;
  }
}
