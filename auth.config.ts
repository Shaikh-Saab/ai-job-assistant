import type { NextAuthConfig } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { oauthProviders } from "@/lib/auth-providers";

/**
 * Edge-safe config shared by middleware and the full Node config in `auth.ts`.
 * Nothing here may import Prisma or bcrypt.
 */

export const PROTECTED_PREFIXES = ["/dashboard", "/jobs", "/projects", "/reports", "/settings"];
export const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

export const authConfig = {
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt" }, // required for the Credentials provider
  // Only register OAuth providers that have keys; an unconfigured one just errors on click.
  providers: [...(oauthProviders.github ? [GitHub] : []), ...(oauthProviders.google ? [Google] : [])],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;

      if (PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
        return isLoggedIn; // false → redirect to /login?callbackUrl=…
      }
      if (isLoggedIn && AUTH_ROUTES.includes(path)) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }
      return true;
    },
    jwt({ token, user, trigger, session }) {
      if (user?.id) token.sub = user.id;
      // Profile edits call `unstable_update`, which lands here; keep the cookie in sync.
      if (trigger === "update" && session?.user) {
        if (session.user.name !== undefined) token.name = session.user.name;
        if (session.user.image !== undefined) token.picture = session.user.image;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
