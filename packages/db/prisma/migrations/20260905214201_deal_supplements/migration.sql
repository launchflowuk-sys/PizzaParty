-- CreateTable
CREATE TABLE "DealSlotSupplement" (
    "id" TEXT NOT NULL,
    "slotId" TEXT NOT NULL,
    "productSlug" TEXT NOT NULL,
    "extra" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DealSlotSupplement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DealSlotSupplement_slotId_productSlug_key" ON "DealSlotSupplement"("slotId", "productSlug");

-- AddForeignKey
ALTER TABLE "DealSlotSupplement" ADD CONSTRAINT "DealSlotSupplement_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "DealSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

