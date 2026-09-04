-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'kg',
    "onHand" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "par" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "supplier" TEXT NOT NULL DEFAULT '',
    "onOrder" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "vehicle" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'available',
    "activeOrderId" TEXT NOT NULL DEFAULT '',
    "backAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'kitchen',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "hoursWeek" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "onShift" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL DEFAULT '',
    "customerName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'direct',
    "reply" TEXT NOT NULL DEFAULT '',
    "repliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockItem_clientId_sortOrder_idx" ON "StockItem"("clientId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_clientId_name_key" ON "StockItem"("clientId", "name");

-- CreateIndex
CREATE INDEX "Driver_clientId_status_idx" ON "Driver"("clientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_clientId_name_key" ON "Driver"("clientId", "name");

-- CreateIndex
CREATE INDEX "Staff_clientId_role_idx" ON "Staff"("clientId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_clientId_name_key" ON "Staff"("clientId", "name");

-- CreateIndex
CREATE INDEX "Review_clientId_createdAt_idx" ON "Review"("clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "StockItem" ADD CONSTRAINT "StockItem_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

