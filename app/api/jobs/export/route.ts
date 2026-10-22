import { NextResponse } from "next/server";
import { currentUserId } from "@/auth";
import { jobsForExport } from "@/lib/data/jobs";
import { toCsv } from "@/lib/csv";
import { JOB_SOURCE_LABELS, JOB_STATUS_LABELS } from "@/lib/validations";

export const dynamic = "force-dynamic";

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/** Download every tracked job as a spreadsheet-friendly CSV. */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobs = await jobsForExport(userId);
  const csv = toCsv(
    ["Title", "Company", "Location", "Remote", "Status", "Match score", "Claude fit", "Pay", "Posted", "Submitted", "Follow up", "Source", "Link", "Notes"],
    jobs.map((j) => [
      j.title, j.company, j.location, j.remote ? "Yes" : "No", JOB_STATUS_LABELS[j.status], j.score,
      j.packet?.fitScore ?? "", j.salaryText ?? "", day(j.postedAt), day(j.submittedAt), day(j.followUpAt),
      JOB_SOURCE_LABELS[j.source] ?? j.source, j.url, j.notes,
    ]),
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="nexus-jobs-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
