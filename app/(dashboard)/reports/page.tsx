import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ReportBuilder } from "@/components/reports/report-builder";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="PDF reports"
        description="Choose what to include, check the live preview, then download a print-ready A4 report built from your current data."
      />
      <ReportBuilder />
    </>
  );
}
