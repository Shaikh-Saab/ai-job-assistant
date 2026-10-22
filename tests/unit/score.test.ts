import { describe, expect, it } from "vitest";
import { matchesLocation, scoreJob, type ScoringProfile } from "@/lib/jobs/score";
import type { RawJob } from "@/lib/jobs/types";

const profile: ScoringProfile = {
  roleKeywords: ["AI engineer", "machine learning", "LLM"],
  skills: ["Python", "SQL"],
  minSalaryUsd: 60_000,
  wantsRelocation: true,
  entryLevelOnly: true,
};

const job = (over: Partial<RawJob> = {}): RawJob => ({
  source: "GREENHOUSE",
  externalId: "1",
  company: "Acme",
  title: "AI Engineer",
  location: "London, UK",
  remote: false,
  url: "https://example.com",
  description: "",
  postedAt: new Date("2026-10-20T00:00:00Z"),
  ...over,
});
const NOW = new Date("2026-10-21T00:00:00Z");

describe("scoreJob", () => {
  it("rates an entry-level AI role highly and explains why", () => {
    const r = scoreJob(job({ title: "Graduate Machine Learning Engineer", description: "Python and SQL. Visa sponsorship available." }), profile, NOW);
    expect(r.relevant).toBe(true);
    expect(r.senior).toBe(false);
    expect(r.score).toBeGreaterThanOrEqual(85);
    expect(r.signals).toEqual(expect.arrayContaining(["Entry-level title", "Relocation or visa support"]));
  });

  it("marks senior titles and scores them lower", () => {
    const junior = scoreJob(job({ title: "Junior AI Engineer" }), profile, NOW);
    const senior = scoreJob(job({ title: "Senior AI Engineer" }), profile, NOW);
    expect(senior.senior).toBe(true);
    expect(senior.score).toBeLessThan(junior.score - 30);
  });

  it("doesn't treat 'AI' inside other words as an AI role", () => {
    const r = scoreJob(job({ title: "Maintenance Coordinator", description: "Maintain the office." }), profile, NOW);
    expect(r.relevant).toBe(false);
  });

  it("penalises '5+ years' requirements unless the posting also welcomes new grads", () => {
    const veteran = scoreJob(job({ description: "Requires 5+ years of experience." }), profile, NOW);
    const both = scoreJob(job({ description: "5+ years preferred, but recent graduates welcome." }), profile, NOW);
    expect(veteran.signals).toContain("Asks for 5+ years");
    expect(both.signals).not.toContain("Asks for 5+ years");
  });

  it("compares pay with the minimum and ignores unknown pay", () => {
    const high = scoreJob(job({ salaryMinUsd: 90_000 }), profile, NOW);
    const low = scoreJob(job({ salaryMinUsd: 30_000 }), profile, NOW);
    const unknown = scoreJob(job(), profile, NOW);
    expect(high.signals).toContain("Pay ≥ your minimum");
    expect(low.signals).toContain("Pay below your minimum");
    expect(high.score).toBeGreaterThan(unknown.score);
    expect(low.score).toBeLessThan(unknown.score);
  });

  it("keeps scores within 0–100", () => {
    const r = scoreJob(
      job({ title: "Graduate AI Engineer intern", description: "LLM machine learning Python SQL relocation package, zapier, 0-2 years", remote: true, salaryMinUsd: 200_000 }),
      profile,
      NOW,
    );
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.score).toBeGreaterThanOrEqual(0);
  });

  it("boosts preferred locations and flags others", () => {
    const p = { ...profile, preferredLocations: ["Germany", "Remote"] };
    const berlin = scoreJob(job({ location: "Berlin" }), p, NOW);
    const austin = scoreJob(job({ location: "Austin, TX" }), p, NOW);
    expect(berlin.signals).toContain("In your preferred locations");
    expect(berlin.outsidePreferredLocations).toBe(false);
    expect(austin.outsidePreferredLocations).toBe(true);
    expect(berlin.score).toBeGreaterThan(austin.score);
  });
});

describe("matchesLocation", () => {
  const m = (location: string, remote = false) => matchesLocation({ location, remote }, ["UK", "Remote", "UAE"]);
  it.each([
    ["London, United Kingdom", true],
    ["Edinburgh, Scotland", true],
    ["Dubai", true],
    ["Ukraine", false], // "UK" must not match inside another word
    ["Paris, France", false],
  ])("%s → %s", (loc, expected) => expect(m(loc)).toBe(expected));

  it("matches remote postings by flag or wording", () => {
    expect(m("Anywhere", false)).toBe(true);
    expect(m("New York", true)).toBe(true);
  });
});
