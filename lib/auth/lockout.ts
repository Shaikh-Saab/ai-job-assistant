import "server-only";
import { Prisma, type LoginAttempt } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Wrong-password protection. After MAX_FAILURES wrong passwords for one email, sign-in for that
 * email pauses for LOCK_MINUTES. Unknown emails are counted the same way, so the messages never
 * reveal whether an account exists. Old mistakes are forgotten after an hour.
 */
export const MAX_FAILURES = 5;
export const LOCK_MINUTES = 15;
const FORGET_AFTER_MS = 60 * 60_000;

export type LockStatus = { locked: true; minutesLeft: number } | { locked: false; triesLeft: number };

function statusOf(row: LoginAttempt | null, now: Date): LockStatus {
  if (!row || isStale(row, now)) return { locked: false, triesLeft: MAX_FAILURES };
  if (row.lockedUntil) {
    return { locked: true, minutesLeft: Math.max(1, Math.ceil((row.lockedUntil.getTime() - now.getTime()) / 60_000)) };
  }
  return { locked: false, triesLeft: Math.max(0, MAX_FAILURES - row.failures) };
}

/** A pause that has ended, or mistakes old enough to forget, start the count again. */
function isStale(row: LoginAttempt, now: Date) {
  if (row.lockedUntil) return row.lockedUntil <= now;
  return now.getTime() - row.lastFailureAt.getTime() > FORGET_AFTER_MS;
}

export async function lockStatus(email: string, now = new Date()): Promise<LockStatus> {
  return statusOf(await prisma.loginAttempt.findUnique({ where: { email } }), now);
}

/** Count one wrong password (atomically, so parallel guesses can't slip past the limit). */
export async function recordFailure(email: string, now = new Date()): Promise<LockStatus> {
  // Columns are UTC "timestamp without time zone"; convert explicitly so the database's own
  // timezone setting can't shift the values.
  const utc = (d: Date) => Prisma.sql`(${d}::timestamptz AT TIME ZONE 'UTC')`;
  const at = utc(now);
  const forgetBefore = utc(new Date(now.getTime() - FORGET_AFTER_MS));
  const [row] = await prisma.$queryRaw<LoginAttempt[]>`
    INSERT INTO "LoginAttempt" ("email", "failures", "lastFailureAt")
    VALUES (${email}, 1, ${at})
    ON CONFLICT ("email") DO UPDATE SET
      "failures" = CASE
        WHEN ("LoginAttempt"."lockedUntil" IS NOT NULL AND "LoginAttempt"."lockedUntil" <= ${at})
          OR ("LoginAttempt"."lockedUntil" IS NULL AND "LoginAttempt"."lastFailureAt" < ${forgetBefore})
        THEN 1 ELSE "LoginAttempt"."failures" + 1 END,
      "lockedUntil" = CASE
        WHEN "LoginAttempt"."lockedUntil" IS NOT NULL AND "LoginAttempt"."lockedUntil" <= ${at}
        THEN NULL ELSE "LoginAttempt"."lockedUntil" END,
      "lastFailureAt" = ${at}
    RETURNING *`;

  if (row.failures >= MAX_FAILURES && !row.lockedUntil) {
    const lockedUntil = new Date(now.getTime() + LOCK_MINUTES * 60_000);
    return statusOf(await prisma.loginAttempt.update({ where: { email }, data: { lockedUntil } }), now);
  }
  return statusOf(row, now);
}

export async function clearFailures(email: string) {
  await prisma.loginAttempt.deleteMany({ where: { email } });
}

/** Housekeeping for the daily cron: drop counters nobody has touched for a day. */
export async function pruneLoginAttempts(now = new Date()) {
  const { count } = await prisma.loginAttempt.deleteMany({
    where: { lastFailureAt: { lt: new Date(now.getTime() - 24 * 60 * 60_000) } },
  });
  return count;
}

/** Plain-language message for the sign-in form. */
export function lockMessage(status: LockStatus) {
  if (status.locked) {
    const m = status.minutesLeft === 1 ? "1 minute" : `${status.minutesLeft} minutes`;
    return `For your safety, sign-in is paused for ${m} after ${MAX_FAILURES} wrong passwords. You can reset your password now, or try again later.`;
  }
  const n = status.triesLeft === 1 ? "1 more try" : `${status.triesLeft} more tries`;
  return `That email and password don’t match. You have ${n} before sign-in is paused for ${LOCK_MINUTES} minutes.`;
}
