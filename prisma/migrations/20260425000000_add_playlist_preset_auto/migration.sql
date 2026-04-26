-- Playlists + per-video presets + auto-mode campaigns

CREATE TABLE "playlists" (
  "id" TEXT NOT NULL,
  "owner_email" TEXT,
  "name" TEXT NOT NULL,
  "folder_path" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "playlists_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "playlists_owner_email_idx" ON "playlists"("owner_email");

CREATE TABLE "playlist_items" (
  "id" TEXT NOT NULL,
  "playlist_id" TEXT NOT NULL,
  "video_asset_id" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "playlist_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "playlist_items_playlist_id_video_asset_id_key" UNIQUE ("playlist_id", "video_asset_id")
);
CREATE INDEX "playlist_items_playlist_id_idx" ON "playlist_items"("playlist_id");
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "playlist_items" ADD CONSTRAINT "playlist_items_video_asset_id_fkey" FOREIGN KEY ("video_asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "media_asset_presets" (
  "id" TEXT NOT NULL,
  "video_asset_id" TEXT NOT NULL,
  "title" TEXT NOT NULL DEFAULT '',
  "description" TEXT NOT NULL DEFAULT '',
  "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "privacy" TEXT NOT NULL DEFAULT 'private',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_asset_presets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "media_asset_presets_video_asset_id_key" UNIQUE ("video_asset_id")
);
ALTER TABLE "media_asset_presets" ADD CONSTRAINT "media_asset_presets_video_asset_id_fkey" FOREIGN KEY ("video_asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "campaigns"
  ADD COLUMN "playlist_id" TEXT,
  ADD COLUMN "auto_mode" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "schedule_pattern" TEXT;
CREATE INDEX "campaigns_playlist_id_idx" ON "campaigns"("playlist_id");
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_playlist_id_fkey" FOREIGN KEY ("playlist_id") REFERENCES "playlists"("id") ON UPDATE CASCADE ON DELETE SET NULL;
