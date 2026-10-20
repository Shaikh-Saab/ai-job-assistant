-- Remove the unused THEMUSE value (its API does not return recent postings).
ALTER TYPE "JobSource" RENAME TO "JobSource_old";
CREATE TYPE "JobSource" AS ENUM ('GREENHOUSE', 'LEVER', 'ASHBY', 'ADZUNA', 'REMOTIVE', 'ARBEITNOW', 'HIMALAYAS', 'JOBICY', 'MANUAL');
ALTER TABLE "Job" ALTER COLUMN "source" TYPE "JobSource" USING ("source"::text::"JobSource");
DROP TYPE "JobSource_old";
