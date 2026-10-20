import { NextResponse, type NextRequest } from "next/server";
import { currentUserId } from "@/auth";
import { listProjects } from "@/lib/data/projects";
import { projectQuerySchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = projectQuerySchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", issues: parsed.error.flatten() }, { status: 400 });
  }

  return NextResponse.json(await listProjects(userId, parsed.data));
}
