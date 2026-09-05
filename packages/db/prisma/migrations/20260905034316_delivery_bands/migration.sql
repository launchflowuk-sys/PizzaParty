-- CreateTable
CREATE TABLE "DeliveryBand" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "prefixes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "fee" INTEGER NOT NULL DEFAULT 0,
    "minOrder" INTEGER NOT NULL DEFAULT 0,
    "extraMinutes" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DeliveryBand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeliveryBand_locationId_idx" ON "DeliveryBand"("locationId");

-- AddForeignKey
ALTER TABLE "DeliveryBand" ADD CONSTRAINT "DeliveryBand_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

