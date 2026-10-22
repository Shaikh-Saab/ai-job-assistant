import { describe, expect, it } from "vitest";
import { htmlToText, parseSalaryText, toUsd, clip } from "@/lib/jobs/text";
import { toCsv } from "@/lib/csv";
import { summarize } from "@/lib/report";
import type { Project } from "@prisma/client";

describe("htmlToText", () => {
  it("decodes Greenhouse's double-escaped HTML into readable text", () => {
    const html = "&lt;p&gt;Build &amp;amp; ship &lt;strong&gt;LLM&lt;/strong&gt; apps&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Python&lt;/li&gt;&lt;li&gt;RAG&lt;/li&gt;&lt;/ul&gt;";
    const text = htmlToText(html);
    expect(text).toContain("Build & ship LLM apps");
    expect(text).toContain("• Python");
    expect(text).not.toMatch(/<|&lt;/);
  });

  it("drops scripts and styles and handles empty input", () => {
    expect(htmlToText("<style>p{}</style><script>alert(1)</script><p>ok</p>")).toBe("ok");
    expect(htmlToText(null)).toBe("");
  });

  it("clips very long text", () => {
    expect(clip("x".repeat(30), 10)).toBe(`${"x".repeat(10)}…`);
  });
});

describe("salary parsing", () => {
  it.each([
    ["$90,000 – $120,000", 90_000],
    ["CA$215K – CA$295K • Offers Equity", Math.round(215_000 * 0.73)],
    ["£45k", Math.round(45_000 * 1.27)],
  ])("parses salary case %# into USD", (text, usd) => expect(parseSalaryText(text)).toBe(usd));

  it("ignores hourly / per-task rates and unknown text", () => {
    expect(parseSalaryText("$40 per hour")).toBeNull();
    expect(parseSalaryText("$1000 per task")).toBeNull();
    expect(parseSalaryText("$4,000 / month")).toBeNull();
    expect(parseSalaryText("$25/hr")).toBeNull();
    expect(parseSalaryText("Competitive")).toBeNull();
  });

  it("converts known currencies only", () => {
    expect(toUsd(100_000, "EUR")).toBe(108_000);
    expect(toUsd(100_000, "XYZ")).toBeNull();
  });
});

describe("toCsv", () => {
  it("quotes commas, quotes and newlines", () => {
    const csv = toCsv(["a", "b"], [["x, y", 'say "hi"'], ["line1\nline2", null]]);
    expect(csv).toBe('﻿a,b\r\n"x, y","say ""hi"""\r\n"line1\nline2",\r\n');
  });

  it("neutralises spreadsheet formulas (CSV injection)", () => {
    const csv = toCsv(["t"], [["=HYPERLINK(\"http://evil\")"], ["+1"], ["@SUM(A1)"], ["-2"]]);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"")"`);
    expect(csv).toContain("'+1");
    expect(csv).toContain("'@SUM(A1)");
    expect(csv).toContain("'-2");
  });
});

describe("report summary", () => {
  const now = new Date("2026-10-15T00:00:00Z");
  const p = (over: Partial<Project>): Project =>
    ({
      id: Math.random().toString(36), name: "P", description: null, status: "ACTIVE", priority: "MEDIUM",
      budget: 1000, progress: 50, dueDate: null, completedAt: null, createdAt: new Date("2026-10-01T00:00:00Z"),
      updatedAt: now, userId: "u", ...over,
    }) as Project;

  it("computes totals, overdue and monthly buckets", () => {
    const s = summarize(
      [
        p({ status: "COMPLETED", progress: 100, completedAt: new Date("2026-10-10T00:00:00Z") }),
        p({ dueDate: new Date("2026-10-01T00:00:00Z") }), // overdue
        p({ status: "PLANNING", progress: 0, budget: 3000 }),
      ],
      now,
    );
    expect(s.total).toBe(3);
    expect(s.completed).toBe(1);
    expect(s.overdue).toBe(1);
    expect(s.budget).toBe(5000);
    expect(s.avgProgress).toBe(50);
    expect(s.monthly).toHaveLength(6);
    expect(s.monthly.at(-1)).toMatchObject({ month: "Oct", created: 3, completed: 1 });
  });

  it("handles an empty report", () => {
    const s = summarize([], now);
    expect(s).toMatchObject({ total: 0, avgProgress: 0, overdue: 0 });
  });
});
