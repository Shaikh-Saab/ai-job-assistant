"use client";

import { useTransition } from "react";
import { oauthSignIn } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import type { OAuthProviderId } from "@/lib/auth-providers";
import { cn } from "@/lib/utils";

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 .5a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.6-1.4-1.4-1.8-1.4-1.8-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.2.5-2.3 1.3-3.1-.2-.4-.6-1.6.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0C17.3 4.7 18.3 5 18.3 5c.7 1.6.2 2.8.1 3.2.8.8 1.3 1.9 1.3 3.1 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.7-4.9h-4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8l4-3Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
    </svg>
  );
}

const META: Record<OAuthProviderId, { label: string; Icon: () => React.JSX.Element }> = {
  github: { label: "GitHub", Icon: GitHubIcon },
  google: { label: "Google", Icon: GoogleIcon },
};

/** Buttons for the OAuth providers that are configured on this deployment (none → renders nothing). */
export function OAuthButtons({
  providers,
  callbackUrl,
  dividerLabel = "or continue with email",
}: {
  providers: OAuthProviderId[];
  callbackUrl?: string;
  dividerLabel?: string;
}) {
  const [pending, startTransition] = useTransition();
  if (providers.length === 0) return null;

  return (
    <>
      <div className={cn("grid gap-3", providers.length > 1 && "sm:grid-cols-2")}>
        {providers.map((p) => {
          const { label, Icon } = META[p];
          return (
            <Button
              key={p}
              variant="outline"
              type="button"
              disabled={pending}
              onClick={() => startTransition(() => oauthSignIn(p, callbackUrl))}
            >
              <Icon />
              {label}
            </Button>
          );
        })}
      </div>
      <div className="relative text-center text-xs uppercase text-muted-foreground">
        <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden="true" />
        <span className="relative bg-card px-2">{dividerLabel}</span>
      </div>
    </>
  );
}
