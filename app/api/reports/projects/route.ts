import { createElement, type ReactElement } from "react";
import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";

import { auth } from "@/auth";
import { REPORT_ROW_LIMIT, getReportProjects } from "@/lib/data/projects";
import { ProjectReport } from "@/lib/pdf/project-report";
import { summarize } from "@/lib/report";
import { PRIORITY_LABELS, STATUS_LABELS, reportQuerySchema } from "@/lib/validations";

export const runtime = "nodejs"; // react-pdf needs Node APIs
export const dynamic = "force-dynamic";

const SORT_LABELS: Record<string, string> = {
  name: "name", status: "status", priority: "priority", budget: "budget",
  progress: "progress", dueDate: "due date", createdAt: "date created",
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = reportQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
  const rows = await getReportProjects(session.user.id, q);
  const generatedAt = new Date();

  const scope = [
    q.status ? STATUS_LABELS[q.status] : "All statuses",
    q.priority ? `${PRIORITY_LABELS[q.priority]} priority` : "all priorities",
    q.search ? `matching “${q.search}”` : null,
    `sorted by ${SORT_LABELS[q.sort]} (${q.order === "asc" ? "ascending" : "descending"})`,
  ]
    .filter(Boolean)
    .join(", ");

  const doc = createElement(ProjectReport, {
    title: q.title || "Portfolio overview",
    preparedFor: session.user.name ? `${session.user.name} <${session.user.email}>` : (session.user.email ?? "You"),
    generatedAt,
    filters: scope,
    sections: q.sections,
    rows,
    summary: summarize(rows, generatedAt),
    truncated: rows.length >= REPORT_ROW_LIMIT,
  }) as unknown as ReactElement<DocumentProps>;

  const pdf = await renderToBuffer(doc);
  const filename = `nexus-report-${generatedAt.toISOString().slice(0, 10)}.pdf`;

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${q.download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
