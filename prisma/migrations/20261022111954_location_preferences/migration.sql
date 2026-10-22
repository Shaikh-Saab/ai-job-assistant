-- AlterTable
ALTER TABLE "JobProfile" ADD COLUMN     "currentLocation" VARCHAR(120) NOT NULL DEFAULT '',
ADD COLUMN     "onlyPreferredLocations" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "preferredLocations" TEXT[];
