-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'sms',
    "days" INTEGER NOT NULL DEFAULT 30,
    "promoCode" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL,
    "subject" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT false,
    "cooldownDays" INTEGER NOT NULL DEFAULT 30,
    "maxPerRun" INTEGER NOT NULL DEFAULT 200,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Automation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingSend" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "automationId" TEXT,
    "campaignId" TEXT,
    "customerId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "promoCode" TEXT NOT NULL DEFAULT '',
    "costPence" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "error" TEXT NOT NULL DEFAULT '',
    "redeemedOrderId" TEXT NOT NULL DEFAULT '',
    "redeemedAt" TIMESTAMP(3),
    "revenuePence" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingSend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Automation_clientId_active_idx" ON "Automation"("clientId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Automation_clientId_name_key" ON "Automation"("clientId", "name");

-- CreateIndex
CREATE INDEX "MarketingSend_clientId_sentAt_idx" ON "MarketingSend"("clientId", "sentAt");

-- CreateIndex
CREATE INDEX "MarketingSend_customerId_sentAt_idx" ON "MarketingSend"("customerId", "sentAt");

-- CreateIndex
CREATE INDEX "MarketingSend_automationId_sentAt_idx" ON "MarketingSend"("automationId", "sentAt");

-- CreateIndex
CREATE INDEX "MarketingSend_clientId_promoCode_idx" ON "MarketingSend"("clientId", "promoCode");

-- AddForeignKey
ALTER TABLE "Automation" ADD CONSTRAINT "Automation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingSend" ADD CONSTRAINT "MarketingSend_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingSend" ADD CONSTRAINT "MarketingSend_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "Automation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingSend" ADD CONSTRAINT "MarketingSend_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

