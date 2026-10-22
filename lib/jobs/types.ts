import type { JobSource } from "@prisma/client";

/** A posting normalized from any source, before scoring. */
export type RawJob = {
  source: JobSource;
  externalId: string;
  company: string;
  title: string;
  location: string;
  remote: boolean;
  url: string;
  description: string;
  salaryText?: string | null;
  salaryMinUsd?: number | null;
  postedAt: Date;
};

/** Outcome of one fetch (one board, one country, or one feed), shown to the user after a search. */
export type SourceReport = {
  source: JobSource;
  label: string;
  fetched: number;
  error?: string;
};

export type SearchSummary = {
  reports: SourceReport[];
  scanned: number;
  matched: number;
  added: number;
  updated: number;
  skippedSources: string[];
  /** Ids of jobs this search created (used by the daily digest). */
  newJobIds: string[];
};
