-- CreateTable
CREATE TABLE "PlaceSearchCache" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "biasKey" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "suggestions" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlaceSearchCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "clientKey" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlaceSearchCache_expiresAt_idx" ON "PlaceSearchCache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PlaceSearchCache_query_biasKey_size_key" ON "PlaceSearchCache"("query", "biasKey", "size");

-- CreateIndex
CREATE INDEX "RateLimit_windowStart_idx" ON "RateLimit"("windowStart");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_clientKey_route_windowStart_key" ON "RateLimit"("clientKey", "route", "windowStart");
