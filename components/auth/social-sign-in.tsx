import { FirebaseButtons } from "@/components/auth/firebase-buttons";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { enabledOAuthProviders } from "@/lib/auth-providers";
import { firebasePublicConfig } from "@/lib/firebase/server";

/** Google/GitHub buttons: through Firebase when it's set up, else direct OAuth, else nothing. */
export function SocialSignIn({ callbackUrl, dividerLabel }: { callbackUrl?: string; dividerLabel?: string }) {
  const firebase = firebasePublicConfig();
  if (firebase && firebase.providers.length > 0) {
    return <FirebaseButtons config={firebase} callbackUrl={callbackUrl} dividerLabel={dividerLabel} />;
  }
  return <OAuthButtons providers={enabledOAuthProviders()} callbackUrl={callbackUrl} dividerLabel={dividerLabel} />;
}
