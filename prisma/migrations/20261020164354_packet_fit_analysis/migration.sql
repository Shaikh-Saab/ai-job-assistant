-- AlterTable
ALTER TABLE "ApplicationPacket" ADD COLUMN     "fitScore" INTEGER,
ADD COLUMN     "fitSummary" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "gaps" TEXT[],
ADD COLUMN     "strengths" TEXT[];
