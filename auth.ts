import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { authConfig } from "@/auth.config";
import { firebaseTokenSignIn, passwordSignIn } from "@/lib/auth/sign-in";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations";

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: { email: {}, password: {} },
      // Wrong-password pause + Firebase or local password check (lib/auth/sign-in.ts).
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        return parsed.success ? passwordSignIn(parsed.data.email, parsed.data.password) : null;
      },
    }),
    // Google/GitHub through Firebase: the browser pop-up returns an ID token we verify here.
    Credentials({
      id: "firebase",
      name: "Firebase",
      credentials: { idToken: {} },
      authorize: (raw) => firebaseTokenSignIn(typeof raw?.idToken === "string" ? raw.idToken : ""),
    }),
  ],
});

/** The signed-in user's id and email, or null. */
export async function currentUser() {
  const session = await auth();
  return session?.user?.id ? { id: session.user.id, email: session.user.email ?? null } : null;
}

/** For server actions / route handlers: the signed-in user's id, or null. */
export async function currentUserId() {
  const session = await auth();
  return session?.user?.id ?? null;
}
