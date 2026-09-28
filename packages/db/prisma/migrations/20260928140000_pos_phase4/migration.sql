-- AlterEnum
ALTER TYPE "Fulfilment" ADD VALUE 'eat_in';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "clientRequestId" TEXT,
ADD COLUMN     "courier" TEXT,
ADD COLUMN     "createdOfflineAt" TIMESTAMP(3),
ADD COLUMN     "externalDisplayId" TEXT,
ADD COLUMN     "externalRef" TEXT,
ADD COLUMN     "needsAttention" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tableNumber" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "clientRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Order_clientId_clientRequestId_key" ON "Order"("clientId", "clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_clientId_externalRef_key" ON "Order"("clientId", "externalRef");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_clientRequestId_key" ON "Payment"("clientRequestId");

