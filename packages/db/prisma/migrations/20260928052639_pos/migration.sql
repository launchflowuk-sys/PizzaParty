-- DropIndex
DROP INDEX "Payment_orderId_key";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "blocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "staffNotes" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'web',
ADD COLUMN     "takenBy" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "tendered" INTEGER;

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");
