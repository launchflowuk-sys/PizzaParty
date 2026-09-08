-- Shop-editable promotional cards for the home screen.
--
-- The image is bytea rather than a path: config/<slug>/assets ships inside the
-- Docker image, so an uploaded file there would disappear on the next deploy.

CREATE TABLE "PromoSlot" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "price" INTEGER,
    "target" TEXT NOT NULL DEFAULT '',
    "image" BYTEA,
    "imageMime" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "placement" TEXT NOT NULL DEFAULT 'featured',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoSlot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PromoSlot_clientId_active_placement_sortOrder_idx"
    ON "PromoSlot"("clientId", "active", "placement", "sortOrder");

ALTER TABLE "PromoSlot" ADD CONSTRAINT "PromoSlot_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
