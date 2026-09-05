-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "notificationsOn" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "ownerEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "ownerSms" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Driver" ADD COLUMN     "email" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "NotificationRule" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NotificationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationRule_clientId_event_idx" ON "NotificationRule"("clientId", "event");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRule_clientId_event_audience_channel_key" ON "NotificationRule"("clientId", "event", "audience", "channel");

-- AddForeignKey
ALTER TABLE "NotificationRule" ADD CONSTRAINT "NotificationRule_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

