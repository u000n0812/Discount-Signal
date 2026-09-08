-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "WatchKind" AS ENUM ('STEAM', 'WEB');

-- CreateTable
CREATE TABLE "Watch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "WatchKind" NOT NULL,
    "label" TEXT NOT NULL,
    "condition" TEXT,
    "minDiscount" INTEGER,
    "targetPrice" INTEGER,
    "steamAppId" INTEGER,
    "url" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSignature" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Watch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "watchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT,
    "priceNow" INTEGER,
    "priceWas" INTEGER,
    "discountPercent" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "matchScore" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "signature" TEXT NOT NULL,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "userId" TEXT NOT NULL,
    "minScore" INTEGER NOT NULL DEFAULT 70,
    "browserNotify" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "Watch_userId_createdAt_idx" ON "Watch"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Watch_active_lastCheckedAt_idx" ON "Watch"("active", "lastCheckedAt");

-- CreateIndex
CREATE INDEX "Alert_userId_createdAt_idx" ON "Alert"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Alert_watchId_signature_key" ON "Alert"("watchId", "signature");

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_watchId_fkey" FOREIGN KEY ("watchId") REFERENCES "Watch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

