import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Runs on the edge: only decodes the JWT and applies `authorized` from authConfig.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
};
