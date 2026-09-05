-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "authorPhoto" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "externalUrl" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "featured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hidden" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "postedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Review_clientId_hidden_rating_idx" ON "Review"("clientId", "hidden", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "Review_clientId_externalId_key" ON "Review"("clientId", "externalId");

