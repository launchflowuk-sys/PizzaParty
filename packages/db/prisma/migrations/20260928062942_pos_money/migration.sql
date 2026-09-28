-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "collectedByDriverId" TEXT;

-- CreateTable
CREATE TABLE "DrawerSession" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedBy" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL DEFAULT '',
    "float" INTEGER NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT NOT NULL DEFAULT '',
    "counted" INTEGER,
    "expected" INTEGER,
    "summary" JSONB,

    CONSTRAINT "DrawerSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrawerMovement" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL DEFAULT '',
    "driverId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrawerMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayClose" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedBy" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "counted" INTEGER,
    "report" JSONB NOT NULL,

    CONSTRAINT "DayClose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceChange" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "oldPrice" INTEGER,
    "newPrice" INTEGER NOT NULL,
    "actor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DrawerSession_clientId_locationId_openedAt_idx" ON "DrawerSession"("clientId", "locationId", "openedAt");

-- CreateIndex
CREATE INDEX "DrawerMovement_sessionId_idx" ON "DrawerMovement"("sessionId");

-- CreateIndex
CREATE INDEX "DrawerMovement_driverId_createdAt_idx" ON "DrawerMovement"("driverId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DayClose_clientId_date_key" ON "DayClose"("clientId", "date");

-- CreateIndex
CREATE INDEX "PriceChange_clientId_createdAt_idx" ON "PriceChange"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_collectedByDriverId_idx" ON "Payment"("collectedByDriverId");

-- AddForeignKey
ALTER TABLE "DrawerMovement" ADD CONSTRAINT "DrawerMovement_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "DrawerSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
