/*
  Warnings:

  - You are about to drop the column `homeBasePlaceId` on the `Day` table. All the data in the column will be lost.
  - You are about to drop the column `leaveAtMinutes` on the `Day` table. All the data in the column will be lost.
  - You are about to drop the column `returnTravelMode` on the `Day` table. All the data in the column will be lost.
  - Added the required column `startAtMinutes` to the `Day` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Day" DROP CONSTRAINT "Day_homeBasePlaceId_fkey";

-- AlterTable
ALTER TABLE "Day" DROP COLUMN "homeBasePlaceId",
DROP COLUMN "leaveAtMinutes",
DROP COLUMN "returnTravelMode",
ADD COLUMN     "endLabel" TEXT,
ADD COLUMN     "endPlaceId" TEXT,
ADD COLUMN     "endTravelMode" "TravelMode" NOT NULL DEFAULT 'WALK',
ADD COLUMN     "startAtMinutes" INTEGER NOT NULL,
ADD COLUMN     "startLabel" TEXT,
ADD COLUMN     "startPlaceId" TEXT;

-- AddForeignKey
ALTER TABLE "Day" ADD CONSTRAINT "Day_startPlaceId_fkey" FOREIGN KEY ("startPlaceId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Day" ADD CONSTRAINT "Day_endPlaceId_fkey" FOREIGN KEY ("endPlaceId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;
