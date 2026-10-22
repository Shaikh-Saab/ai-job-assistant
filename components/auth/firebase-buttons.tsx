"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Auth, AuthProvider } from "firebase/auth";

import { firebaseSignIn } from "@/actions/auth";
import { FormAlert } from "@/components/auth/form-alert";
import { GitHubIcon, GoogleIcon } from "@/components/auth/oauth-buttons";
import { bigButton } from "@/components/auth/sizes";
import { Button } from "@/components/ui/button";
import type { FirebasePublicConfig, FirebaseProviderId } from "@/lib/firebase/server";

type Loaded = {
  auth: Auth;
  providers: Record<FirebaseProviderId, () => AuthProvider>;
  signInWithPopup: typeof import("firebase/auth").signInWithPopup;
  signOut: typeof import("firebase/auth").signOut;
};

const LABELS: Record<FirebaseProviderId, { label: string; Icon: () => React.JSX.Element }> = {
  google: { label: "Continue with Google", Icon: GoogleIcon },
  github: { label: "Continue with GitHub", Icon: GitHubIcon },
};

const POPUP_ERRORS: Record<string, string> = {
  "auth/popup-blocked": "Your browser blocked the sign-in window. Please allow pop-ups for this site, then press the button again.",
  "auth/account-exists-with-different-credential":
    "This email already uses a different sign-in method. Please use that one, or sign in with your email and password.",
  "auth/unauthorized-domain": "This sign-in method isn’t ready on this website yet. Please use your email and password for now.",
  "auth/network-request-failed": "We couldn’t reach the sign-in service. Please check your internet connection and try again.",
};

/**
 * Google/GitHub sign-in through Firebase. The pop-up returns a one-time ID token, which the
 * server verifies before starting a normal session. Nothing is kept in the browser afterwards.
 */
export function FirebaseButtons({
  config,
  callbackUrl,
  dividerLabel = "or use your email",
}: {
  config: FirebasePublicConfig;
  callbackUrl?: string;
  dividerLabel?: string;
}) {
  const loaded = useRef<Loaded | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Load Firebase ahead of the click: browsers only allow pop-ups opened straight from a click.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ getApps, initializeApp }, fa] = await Promise.all([import("firebase/app"), import("firebase/auth")]);
      const app = getApps().find((a) => a.name === "nexus") ?? initializeApp(config, "nexus");
      let auth: Auth;
      try {
        auth = fa.initializeAuth(app, { persistence: fa.inMemoryPersistence, popupRedirectResolver: fa.browserPopupRedirectResolver });
      } catch {
        auth = fa.getAuth(app); // already set up (e.g. after a hot reload)
      }
      if (cancelled) return;
      loaded.current = {
        auth,
        providers: {
          google: () => {
            const p = new fa.GoogleAuthProvider();
            p.setCustomParameters({ prompt: "select_account" });
            return p;
          },
          github: () => new fa.GithubAuthProvider(),
        },
        signInWithPopup: fa.signInWithPopup,
        signOut: fa.signOut,
      };
      setReady(true);
    })().catch(() => setError("Google sign-in couldn’t load. Please use your email and password instead."));
    return () => {
      cancelled = true;
    };
  }, [config]);

  const go = (id: FirebaseProviderId) => {
    const fb = loaded.current;
    if (!fb) return;
    setError(null);
    // Open the pop-up synchronously inside the click handler.
    const popup = fb.signInWithPopup(fb.auth, fb.providers[id]());
    startTransition(async () => {
      try {
        const { user } = await popup;
        const idToken = await user.getIdToken();
        await fb.signOut(fb.auth); // the server session takes over from here
        const res = await firebaseSignIn(idToken, callbackUrl);
        if (res && !res.ok) setError(res.error); // success redirects server-side
      } catch (e) {
        const code = (e as { code?: string }).code ?? "";
        if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request") return;
        if (!code) throw e; // NEXT_REDIRECT from a successful sign-in
        setError(POPUP_ERRORS[code] ?? "Sign-in didn’t finish. Please try again, or use your email and password.");
      }
    });
  };

  if (config.providers.length === 0) return null;

  return (
    <>
      {error && <FormAlert>{error}</FormAlert>}
      <div className="grid gap-3">
        {config.providers.map((id) => {
          const { label, Icon } = LABELS[id];
          return (
            <Button
              key={id}
              type="button"
              variant="outline"
              className={`${bigButton} gap-3 border-2 [&_svg]:size-6`}
              disabled={!ready || pending}
              loading={pending}
              onClick={() => go(id)}
            >
              <Icon />
              {label}
            </Button>
          );
        })}
      </div>
      <div className="relative text-center text-base text-muted-foreground">
        <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden="true" />
        <span className="relative bg-card px-3">{dividerLabel}</span>
      </div>
    </>
  );
}
