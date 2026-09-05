-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "optOutAt" TIMESTAMP(3),
ADD COLUMN     "optOutSource" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referralRewardedAt" TIMESTAMP(3),
ADD COLUMN     "referredById" TEXT;

-- AlterTable
ALTER TABLE "MarketingSend" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'automation';

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "recoveryRequestedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Promo" ADD COLUMN     "issuedToCustomerId" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "SmsInbound" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "customerId" TEXT,
    "fromPhone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "keyword" TEXT NOT NULL DEFAULT '',
    "providerId" TEXT NOT NULL DEFAULT '',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsInbound_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsInbound_clientId_receivedAt_idx" ON "SmsInbound"("clientId", "receivedAt");

-- CreateIndex
CREATE INDEX "Customer_referredById_idx" ON "Customer"("referredById");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_clientId_referralCode_key" ON "Customer"("clientId", "referralCode");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsInbound" ADD CONSTRAINT "SmsInbound_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsInbound" ADD CONSTRAINT "SmsInbound_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

