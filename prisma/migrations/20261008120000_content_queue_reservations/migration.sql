-- Distinguish the application's content queue lifecycle from YouTube playlists.
CREATE TYPE "QueueItemStatus" AS ENUM ('available', 'reserved', 'published');

ALTER TABLE "playlists" ALTER COLUMN "folder_path" DROP NOT NULL;

ALTER TABLE "media_assets" ADD COLUMN "source_path" TEXT;
CREATE INDEX "media_assets_source_path_idx" ON "media_assets"("source_path");

ALTER TABLE "playlist_items"
  ADD COLUMN "status" "QueueItemStatus" NOT NULL DEFAULT 'available',
  ADD COLUMN "reserved_at" TIMESTAMP(3),
  ADD COLUMN "published_at" TIMESTAMP(3),
  ADD COLUMN "reservation_token" TEXT;

CREATE UNIQUE INDEX "playlist_items_reservation_token_key"
  ON "playlist_items"("reservation_token");

ALTER TABLE "campaigns" ADD COLUMN "queue_item_id" TEXT;
CREATE INDEX "campaigns_queue_item_id_idx" ON "campaigns"("queue_item_id");
ALTER TABLE "campaigns"
  ADD CONSTRAINT "campaigns_queue_item_id_fkey"
  FOREIGN KEY ("queue_item_id") REFERENCES "playlist_items"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
