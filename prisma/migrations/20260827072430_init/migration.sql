-- CreateEnum
CREATE TYPE "TravelMode" AS ENUM ('WALK', 'CYCLE', 'DRIVE', 'TRANSIT');

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "editTokenHash" TEXT NOT NULL,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "providerPlaceId" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "openingHours" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Place_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Day" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "label" TEXT,
    "position" INTEGER NOT NULL,
    "leaveAtMinutes" INTEGER NOT NULL,
    "homeBasePlaceId" TEXT,
    "returnTravelMode" "TravelMode" NOT NULL DEFAULT 'WALK',

    CONSTRAINT "Day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stop" (
    "id" TEXT NOT NULL,
    "dayId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "stayMinutes" INTEGER NOT NULL,
    "travelMode" "TravelMode" NOT NULL,
    "note" TEXT,

    CONSTRAINT "Stop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegCache" (
    "id" TEXT NOT NULL,
    "originKey" TEXT NOT NULL,
    "destinationKey" TEXT NOT NULL,
    "mode" "TravelMode" NOT NULL,
    "timeBucket" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Trip_slug_key" ON "Trip"("slug");

-- CreateIndex
CREATE INDEX "Trip_userId_idx" ON "Trip"("userId");

-- CreateIndex
CREATE INDEX "Place_tripId_idx" ON "Place"("tripId");

-- CreateIndex
CREATE INDEX "Place_providerPlaceId_idx" ON "Place"("providerPlaceId");

-- CreateIndex
CREATE INDEX "Day_tripId_idx" ON "Day"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "Day_tripId_position_key" ON "Day"("tripId", "position");

-- CreateIndex
CREATE INDEX "Stop_dayId_idx" ON "Stop"("dayId");

-- CreateIndex
CREATE UNIQUE INDEX "Stop_dayId_position_key" ON "Stop"("dayId", "position");

-- CreateIndex
CREATE INDEX "LegCache_expiresAt_idx" ON "LegCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegCache_originKey_destinationKey_mode_timeBucket_key" ON "LegCache"("originKey", "destinationKey", "mode", "timeBucket");

-- AddForeignKey
ALTER TABLE "Place" ADD CONSTRAINT "Place_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Day" ADD CONSTRAINT "Day_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Day" ADD CONSTRAINT "Day_homeBasePlaceId_fkey" FOREIGN KEY ("homeBasePlaceId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stop" ADD CONSTRAINT "Stop_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "Day"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stop" ADD CONSTRAINT "Stop_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;
