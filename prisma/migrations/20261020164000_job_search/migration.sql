-- CreateEnum
CREATE TYPE "JobSource" AS ENUM ('GREENHOUSE', 'LEVER', 'ASHBY', 'ADZUNA', 'REMOTIVE', 'ARBEITNOW', 'MANUAL');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('NEW', 'SHORTLISTED', 'PREPARED', 'SUBMITTED', 'INTERVIEW', 'OFFER', 'REJECTED', 'SKIPPED');

-- CreateTable
CREATE TABLE "JobProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "headline" VARCHAR(160) NOT NULL DEFAULT '',
    "resumeText" TEXT NOT NULL DEFAULT '',
    "skills" TEXT[],
    "roleKeywords" TEXT[],
    "countries" TEXT[],
    "greenhouseBoards" TEXT[],
    "leverBoards" TEXT[],
    "ashbyBoards" TEXT[],
    "minSalaryUsd" INTEGER,
    "wantsRelocation" BOOLEAN NOT NULL DEFAULT true,
    "entryLevelOnly" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "JobSource" NOT NULL,
    "externalId" TEXT NOT NULL,
    "company" VARCHAR(160) NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "location" VARCHAR(240) NOT NULL DEFAULT '',
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "url" VARCHAR(1000) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "salaryText" VARCHAR(160),
    "salaryMinUsd" INTEGER,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "signals" TEXT[],
    "status" "JobStatus" NOT NULL DEFAULT 'NEW',
    "submittedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationPacket" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "coverLetter" TEXT NOT NULL DEFAULT '',
    "answers" JSONB NOT NULL DEFAULT '[]',
    "checks" TEXT[],
    "checklist" JSONB NOT NULL DEFAULT '{}',
    "model" TEXT,
    "generatedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationPacket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JobProfile_userId_key" ON "JobProfile"("userId");

-- CreateIndex
CREATE INDEX "Job_userId_status_score_idx" ON "Job"("userId", "status", "score");

-- CreateIndex
CREATE INDEX "Job_userId_postedAt_idx" ON "Job"("userId", "postedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Job_userId_source_externalId_key" ON "Job"("userId", "source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationPacket_jobId_key" ON "ApplicationPacket"("jobId");

-- AddForeignKey
ALTER TABLE "JobProfile" ADD CONSTRAINT "JobProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationPacket" ADD CONSTRAINT "ApplicationPacket_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
