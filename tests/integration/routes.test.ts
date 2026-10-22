import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({ user: null as { id: string; email: string } | null }));
vi.mock("@/auth", () => ({
  currentUserId: async () => state.user?.id ?? null,
  currentUser: async () => state.user,
  auth: async () => (state.user ? { user: state.user } : null),
}));
vi.mock("@/lib/jobs/digest", () => ({ runDailyDigests: vi.fn(async () => ({ processed: 0, waiting: 0, results: [] })) }));

import { GET as exportCsv } from "@/app/api/jobs/export/route";
import { GET as cron } from "@/app/api/cron/daily/route";
import { GET as reportPdf } from "@/app/api/reports/projects/route";
import { GET as projectsApi } from "@/app/api/projects/route";
import { cleanup, makeUser, prisma } from "../support/db";

let alice: { id: string; email: string };

beforeAll(async () => {
  await cleanup();
  alice = await makeUser("alice");
  await prisma.job.create({
    data: {
      userId: alice.id, source: "MANUAL", externalId: "x1", company: "Comma, Inc", title: "=CMD()", url: "https://e.com",
      postedAt: new Date(), score: 80, status: "SUBMITTED",
    },
  });
  await prisma.project.create({ data: { userId: alice.id, name: "Report me", budget: 5000 } });
});
afterAll(cleanup);

describe("API routes", () => {
  it("requires sign-in for data routes", async () => {
    state.user = null;
    expect((await exportCsv()).status).toBe(401);
    expect((await projectsApi(new NextRequest("http://x/api/projects"))).status).toBe(401);
  });

  it("exports jobs as safe CSV", async () => {
    state.user = alice;
    const res = await exportCsv();
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toMatch(/attachment; filename="nexus-jobs-\d{4}-\d{2}-\d{2}\.csv"/);
    const body = await res.text();
    expect(body).toContain('"Comma, Inc"');
    expect(body).toContain("'=CMD()"); // formula neutralised
    expect(body).toContain("Submitted");
  });

  it("builds a real PDF report", async () => {
    state.user = alice;
    const res = await reportPdf(new NextRequest("http://x/api/reports/projects?sections=summary,projects"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(5000);
  });

  it("protects the daily cron with CRON_SECRET", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await cron(new NextRequest("http://x/api/cron/daily"))).status).toBe(401);
    expect((await cron(new NextRequest("http://x/api/cron/daily", { headers: { authorization: "Bearer wrong" } }))).status).toBe(401);
    const ok = await cron(new NextRequest("http://x/api/cron/daily", { headers: { authorization: "Bearer s3cret" } }));
    expect(ok.status).toBe(200);
    delete process.env.CRON_SECRET;
    // With no secret configured the endpoint stays closed.
    expect((await cron(new NextRequest("http://x/api/cron/daily", { headers: { authorization: "Bearer " } }))).status).toBe(401);
  });
});
