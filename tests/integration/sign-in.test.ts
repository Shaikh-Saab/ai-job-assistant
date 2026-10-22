import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ---------- an in-memory stand-in for Firebase Authentication (no network) ----------
const fb = vi.hoisted(() => {
  class FirebaseRestError extends Error {
    constructor(public code: string) {
      super(`Firebase: ${code}`);
    }
  }
  type FbUser = { uid: string; email: string; password: string | null; emailVerified: boolean };
  const users = new Map<string, FbUser>(); // by email
  const byUid = (uid: string) => [...users.values()].find((u) => u.uid === uid);
  let n = 0;
  const add = (email: string, password: string | null, emailVerified = false) => {
    const u = { uid: `fb_${++n}`, email, password, emailVerified };
    users.set(email, u);
    return u;
  };
  const decoded = new Map<string, Record<string, unknown>>(); // idToken → claims
  const mint = (u: FbUser, extra: Record<string, unknown> = {}) => {
    const token = `tok_${u.uid}_${decoded.size}`;
    decoded.set(token, { uid: u.uid, email: u.email, email_verified: u.emailVerified, auth_time: Math.floor(Date.now() / 1000), ...extra });
    return token;
  };
  const state = { enabled: false, outage: false };
  const sendPasswordReset = vi.fn(async (email: string, _continueUrl?: string) => {
    if (!users.has(email)) throw new FirebaseRestError("EMAIL_NOT_FOUND");
    return {};
  });

  return {
    FirebaseRestError,
    users,
    add,
    mint,
    state,
    sendPasswordReset,
    rest: {
      async signInWithPassword(email: string, password: string) {
        if (state.outage) throw new FirebaseRestError("HTTP_503");
        const u = users.get(email);
        if (!u || u.password !== password) throw new FirebaseRestError("INVALID_LOGIN_CREDENTIALS");
        return { localId: u.uid, idToken: mint(u) };
      },
      async signUp(email: string, password: string) {
        if (users.has(email)) throw new FirebaseRestError("EMAIL_EXISTS");
        const u = add(email, password);
        return { localId: u.uid, idToken: mint(u) };
      },
      sendPasswordReset,
    },
    admin: {
      async verifyIdToken(token: string) {
        const claims = decoded.get(token);
        if (!claims) throw Object.assign(new Error("bad token"), { code: "auth/argument-error" });
        return claims;
      },
      async createUser({ email, password }: { email: string; password?: string }) {
        if (users.has(email)) throw Object.assign(new Error("exists"), { code: "auth/email-already-exists" });
        return add(email, password ?? null);
      },
      async getUserByEmail(email: string) {
        const u = users.get(email);
        if (!u) throw Object.assign(new Error("not found"), { code: "auth/user-not-found" });
        return u;
      },
      async getUser(uid: string) {
        const u = byUid(uid)!;
        return { ...u, providerData: u.password ? [{ providerId: "password" }] : [] };
      },
      async updateUser(uid: string, { password }: { password?: string }) {
        const u = byUid(uid)!;
        if (password) u.password = password;
        return u;
      },
    },
  };
});

vi.mock("@/lib/firebase/server", () => ({
  FirebaseRestError: fb.FirebaseRestError,
  WRONG_CREDENTIALS: new Set(["INVALID_LOGIN_CREDENTIALS", "INVALID_PASSWORD", "EMAIL_NOT_FOUND", "USER_DISABLED"]),
  firebaseConfigured: () => fb.state.enabled,
  firebasePublicConfig: () => null,
  adminAuth: () => fb.admin,
  firebaseRest: fb.rest,
}));

// Auth.js's signIn, reduced to what matters here: run the real authorize logic, throw like Auth.js on failure.
const session = vi.hoisted(() => ({ user: null as { id: string } | null }));
vi.mock("@/auth", () => ({
  signIn: vi.fn(async (provider: string, opts: { email?: string; password?: string; idToken?: string }) => {
    const { passwordSignIn, firebaseTokenSignIn } = await import("@/lib/auth/sign-in");
    const { AuthError, CredentialsSignin } = await import("next-auth");
    let user;
    try {
      user = provider === "firebase" ? await firebaseTokenSignIn(opts.idToken!) : await passwordSignIn(opts.email!, opts.password!);
    } catch (cause) {
      throw new AuthError("authorize threw", { cause: cause as Error }); // Auth.js wraps it as CallbackRouteError
    }
    if (!user) throw new CredentialsSignin();
    session.user = user;
  }),
  signOut: vi.fn(),
}));

import { firebaseSignIn, login, register, requestPasswordReset, resetPassword } from "@/actions/auth";
import { LOCK_MINUTES, lockStatus, MAX_FAILURES, pruneLoginAttempts, recordFailure } from "@/lib/auth/lockout";
import { firebaseTokenSignIn, passwordSignIn } from "@/lib/auth/sign-in";
import { createPasswordResetToken } from "@/lib/tokens";
import { cleanup, makeUser, prisma } from "../support/db";

const PW = "Password123!"; // makeUser's password
const unique = (tag: string) => `test_${tag}_${Math.random().toString(36).slice(2, 8)}@nexus.test`;

beforeAll(cleanup);
afterAll(cleanup);
beforeEach(() => {
  session.user = null;
  fb.state.enabled = false;
  fb.state.outage = false;
});
afterEach(() => vi.useRealTimers());

describe("wrong-password pause", () => {
  it(`counts down, pauses after ${MAX_FAILURES} wrong passwords, and lifts after ${LOCK_MINUTES} minutes`, async () => {
    const u = await makeUser("lock");
    for (let i = 1; i < MAX_FAILURES; i++) expect(await passwordSignIn(u.email, "wrong")).toBeNull();
    expect(await lockStatus(u.email)).toEqual({ locked: false, triesLeft: 1 });

    expect(await passwordSignIn(u.email, "wrong")).toBeNull();
    expect(await lockStatus(u.email)).toEqual({ locked: true, minutesLeft: LOCK_MINUTES });

    // Even the right password is refused while paused.
    expect(await passwordSignIn(u.email, PW)).toBeNull();

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + (LOCK_MINUTES + 1) * 60_000);
    expect(await passwordSignIn(u.email, PW)).toMatchObject({ id: u.id });
    expect(await prisma.loginAttempt.count({ where: { email: u.email } })).toBe(0); // success clears it
  });

  it("treats unknown emails exactly like real ones (no account fishing)", async () => {
    const email = unique("ghost");
    for (let i = 0; i < MAX_FAILURES; i++) await passwordSignIn(email, "guess");
    expect((await lockStatus(email)).locked).toBe(true);
  });

  it("forgets old mistakes after an hour", async () => {
    const email = unique("old");
    const start = new Date();
    for (let i = 0; i < 3; i++) await recordFailure(email, start);
    expect(await recordFailure(email, new Date(start.getTime() + 61 * 60_000))).toEqual({ locked: false, triesLeft: MAX_FAILURES - 1 });
  });

  it("can't be dodged with parallel guesses", async () => {
    const email = unique("race");
    await Promise.all(Array.from({ length: MAX_FAILURES + 3 }, () => recordFailure(email)));
    expect((await lockStatus(email)).locked).toBe(true);
  });

  it("shows plain-language messages with tries left, then the pause", async () => {
    const u = await makeUser("msg");
    const first = await login({ email: u.email, password: "nope" });
    expect(first).toMatchObject({ ok: false, code: "wrong" });
    expect((first as { error: string }).error).toContain(`You have ${MAX_FAILURES - 1} more tries`);

    for (let i = 2; i < MAX_FAILURES; i++) await login({ email: u.email, password: "nope" });
    const last = await login({ email: u.email, password: "nope" });
    expect(last).toMatchObject({ ok: false, code: "locked" });
    expect((last as { error: string }).error).toMatch(/paused for 15 minutes.*reset your password/);

    expect(await login({ email: u.email, password: PW })).toMatchObject({ ok: false, code: "locked" });
    expect(session.user).toBeNull();
  });

  it("a completed password reset lifts the pause", async () => {
    const u = await makeUser("unlock");
    for (let i = 0; i < MAX_FAILURES; i++) await passwordSignIn(u.email, "wrong");
    const token = await createPasswordResetToken(u.email);
    expect((await resetPassword({ token, password: "NewPassword9", confirmPassword: "NewPassword9" })).ok).toBe(true);
    expect((await login({ email: u.email, password: "NewPassword9" })).ok).toBe(true);
  });

  it("the daily cron drops counters older than a day", async () => {
    const email = unique("stale");
    await recordFailure(email, new Date(Date.now() - 2 * 86_400_000));
    expect(await pruneLoginAttempts()).toBeGreaterThanOrEqual(1);
    expect(await prisma.loginAttempt.count({ where: { email } })).toBe(0);
  });
});

describe("Firebase sign-in", () => {
  beforeEach(() => {
    fb.state.enabled = true;
  });

  it("moves an existing password account to Firebase on its next sign-in, keeping the same password", async () => {
    const u = await makeUser("legacy");
    expect(await passwordSignIn(u.email, PW)).toMatchObject({ id: u.id });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.firebaseUid).toBe(fb.users.get(u.email)!.uid);
    expect(after.passwordHash).toBeNull(); // Firebase holds the password now
    expect(fb.users.get(u.email)!.password).toBe(PW);

    expect(await passwordSignIn(u.email, PW)).toMatchObject({ id: u.id }); // now straight through Firebase
    expect(await passwordSignIn(u.email, "wrong")).toBeNull();
    expect(await lockStatus(u.email)).toEqual({ locked: false, triesLeft: MAX_FAILURES - 1 });
  });

  it("registers new people in Firebase and links them", async () => {
    const email = unique("new");
    const res = await register({ name: "Ann Lee", email, password: "Password1x", confirmPassword: "Password1x" });
    expect(res.ok).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user).toMatchObject({ firebaseUid: fb.users.get(email)!.uid, passwordHash: null, name: "Ann Lee" });
    expect(session.user).toMatchObject({ id: user.id });
  });

  it("refuses to register an email Firebase already has", async () => {
    const email = unique("taken");
    fb.add(email, "Someone1x");
    expect(await register({ name: "Ann Lee", email, password: "Password1x", confirmPassword: "Password1x" })).toMatchObject({
      ok: false,
      error: "An account with this email already exists",
    });
  });

  it("signs in with Google: creates new users and links verified emails to existing accounts", async () => {
    const fresh = fb.add(unique("google"), null, true);
    const created = await firebaseTokenSignIn(fb.mint(fresh));
    expect(created).toMatchObject({ email: fresh.email });

    const local = await makeUser("gmail");
    const google = fb.add(local.email, null, true);
    expect(await firebaseTokenSignIn(fb.mint(google))).toMatchObject({ id: local.id });
  });

  it("never lets an unverified Firebase account take over someone else's account", async () => {
    const victim = await makeUser("victim");
    const attacker = fb.add(victim.email, "attacker1A"); // registered straight against Firebase, email unconfirmed
    expect(await firebaseTokenSignIn(fb.mint(attacker))).toBeNull();
    expect(await passwordSignIn(victim.email, "attacker1A")).toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: victim.id } })).firebaseUid).toBeNull();
    // The real owner's own password still works, and takes the Firebase record back.
    expect(await passwordSignIn(victim.email, PW)).toMatchObject({ id: victim.id });
    expect(fb.users.get(victim.email)!.password).toBe(PW);
  });

  it("rejects stale or forged ID tokens", async () => {
    const u = fb.add(unique("stale"), null, true);
    expect(await firebaseTokenSignIn(fb.mint(u, { auth_time: Math.floor(Date.now() / 1000) - 3600 }))).toBeNull();
    expect(await firebaseTokenSignIn("not-a-real-token")).toBeNull();
    expect(await firebaseSignIn("not-a-real-token")).toMatchObject({ ok: false });
  });

  it("sends reset emails through Firebase, and the old password stops working once a new one is set", async () => {
    const u = await makeUser("reset");
    const res = await requestPasswordReset({ email: u.email });
    expect(res).toMatchObject({ ok: true });
    expect(fb.sendPasswordReset).toHaveBeenLastCalledWith(u.email, "https://nexus.test/login?reset=1");

    const linked = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(linked.firebaseUid).toBe(fb.users.get(u.email)!.uid);
    expect(linked.passwordHash).not.toBeNull(); // a reset *request* alone must not lock the owner out
    expect(await passwordSignIn(u.email, PW)).toMatchObject({ id: u.id });

    // Later the person follows a new reset link and picks a new password in Firebase.
    const u2 = await makeUser("reset2");
    await requestPasswordReset({ email: u2.email });
    fb.users.get(u2.email)!.password = "BrandNew9x";
    expect(await passwordSignIn(u2.email, PW)).toBeNull();
    expect(await passwordSignIn(u2.email, "BrandNew9x")).toMatchObject({ id: u2.id });
  });

  it("gives the same answer for unknown emails", async () => {
    expect(await requestPasswordReset({ email: unique("nobody") })).toMatchObject({ ok: true });
  });

  it("doesn't count a Firebase outage as a wrong password", async () => {
    const u = await makeUser("outage");
    fb.state.outage = true;
    await expect(passwordSignIn(u.email, PW)).rejects.toThrow();
    expect(await lockStatus(u.email)).toEqual({ locked: false, triesLeft: MAX_FAILURES });
    const res = await login({ email: u.email, password: PW });
    expect(res).toMatchObject({ ok: false });
    expect((res as { error: string }).error).toMatch(/try again/);
  });
});
