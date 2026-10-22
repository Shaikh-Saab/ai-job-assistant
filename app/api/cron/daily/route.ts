import { NextResponse, type NextRequest } from "next/server";
import { runDailyDigests } from "@/lib/jobs/digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Hobby plans allow 60s; stop starting new users after ~40s.
export const maxDuration = 60;

/**
 * Daily job: auto-search + email digest for users who opted in.
 * Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET` (see vercel.json).
 * Elsewhere, call it from any scheduler with the same header.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const outcome = await runDailyDigests({ budgetMs: 40_000 });
  return NextResponse.json(outcome, { headers: { "Cache-Control": "no-store" } });
}
