import { NextResponse } from "next/server";
import { currentUserId } from "@/auth";
import { getDashboardStats } from "@/lib/data/projects";

export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(await getDashboardStats(userId), {
    headers: { "Cache-Control": "no-store" },
  });
}
