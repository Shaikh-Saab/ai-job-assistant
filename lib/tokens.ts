import "server-only";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Creates a single-use reset token; returns the raw token (only ever sent by email). */
export async function createPasswordResetToken(email: string) {
  const token = randomBytes(32).toString("hex");

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { email } }),
    prisma.passwordResetToken.create({
      data: { email, tokenHash: hashToken(token), expires: new Date(Date.now() + RESET_TTL_MS) },
    }),
  ]);

  return token;
}
