-- CreateEnum
CREATE TYPE "JobEventType" AS ENUM ('FOUND', 'STATUS', 'DRAFTED', 'PACKET_SAVED', 'SUBMITTED', 'FOLLOW_UP_SET', 'FOLLOWED_UP', 'INTERVIEW_PREP');

-- AlterTable
ALTER TABLE "ApplicationPacket" ADD COLUMN     "interviewPrep" JSONB;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "followUpAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "JobProfile" ADD COLUMN     "dailyDigest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastDigestAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "JobEvent" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" "JobEventType" NOT NULL,
    "detail" VARCHAR(300) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JobEvent_jobId_createdAt_idx" ON "JobEvent"("jobId", "createdAt");

-- CreateIndex
CREATE INDEX "Job_userId_followUpAt_idx" ON "Job"("userId", "followUpAt");

-- AddForeignKey
ALTER TABLE "JobEvent" ADD CONSTRAINT "JobEvent_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep the new table closed to Supabase's auto-generated API (the app's role bypasses RLS).
ALTER TABLE "JobEvent" ENABLE ROW LEVEL SECURITY;
