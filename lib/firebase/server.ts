import "server-only";
import { cert, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

/**
 * Firebase Authentication (free Spark plan). Turned on by two env vars:
 *   FIREBASE_API_KEY          – the Web API key from Project settings → General
 *   FIREBASE_SERVICE_ACCOUNT  – the whole JSON file from Project settings → Service accounts
 * Without them the app keeps using its own email/password sign-in.
 */

type ParsedAccount = ServiceAccount & { projectId: string };

function serviceAccount(): ParsedAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const json = JSON.parse(raw) as { project_id?: string; client_email?: string; private_key?: string };
    if (!json.project_id || !json.client_email || !json.private_key) return null;
    // Dashboards sometimes store the key's newlines as the two characters "\n".
    return { projectId: json.project_id, clientEmail: json.client_email, privateKey: json.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

export const firebaseConfigured = () => !!process.env.FIREBASE_API_KEY && !!serviceAccount();

export type FirebaseProviderId = "google" | "github";

/** What the browser needs for the Google/GitHub pop-up. All of it is public by design. */
export function firebasePublicConfig() {
  const account = serviceAccount();
  if (!process.env.FIREBASE_API_KEY || !account) return null;
  const providers = (process.env.FIREBASE_SIGN_IN_PROVIDERS ?? "google")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is FirebaseProviderId => p === "google" || p === "github");
  return {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || `${account.projectId}.firebaseapp.com`,
    projectId: account.projectId,
    providers,
  };
}

export type FirebasePublicConfig = NonNullable<ReturnType<typeof firebasePublicConfig>>;

export function adminAuth() {
  const account = serviceAccount();
  if (!account) throw new Error("Firebase is not configured");
  const app = getApps().find((a) => a.name === "nexus") ?? initializeApp({ credential: cert(account), projectId: account.projectId }, "nexus");
  return getAuth(app);
}

// ---------- Identity Toolkit REST API (what the Firebase web SDK calls under the hood) ----------

export class FirebaseRestError extends Error {
  constructor(public code: string) {
    super(`Firebase: ${code}`);
  }
}

/** Codes that mean "wrong email or password", with or without email-enumeration protection. */
export const WRONG_CREDENTIALS = new Set(["INVALID_LOGIN_CREDENTIALS", "INVALID_PASSWORD", "EMAIL_NOT_FOUND", "USER_DISABLED"]);

async function identityToolkit<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${method}?key=${process.env.FIREBASE_API_KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & T;
  // Messages look like "WEAK_PASSWORD : Password should be at least 6 characters".
  if (!res.ok) throw new FirebaseRestError(String(json.error?.message ?? `HTTP_${res.status}`).split(" ")[0]);
  return json;
}

export const firebaseRest = {
  signInWithPassword: (email: string, password: string) =>
    identityToolkit<{ localId: string; idToken: string }>("signInWithPassword", { email, password, returnSecureToken: true }),
  signUp: (email: string, password: string) =>
    identityToolkit<{ localId: string; idToken: string }>("signUp", { email, password, returnSecureToken: true }),
  /** Firebase writes and sends the reset email itself – no SMTP needed. */
  sendPasswordReset: (email: string, continueUrl?: string) =>
    identityToolkit("sendOobCode", { requestType: "PASSWORD_RESET", email, ...(continueUrl ? { continueUrl } : {}) }),
};
