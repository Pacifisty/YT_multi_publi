ALTER TABLE "campaign_targets"
ADD COLUMN "platform" TEXT NOT NULL DEFAULT 'youtube',
ADD COLUMN "destination_id" TEXT,
ADD COLUMN "destination_label" TEXT,
ADD COLUMN "connected_account_id" TEXT,
ADD COLUMN "external_publish_id" TEXT;

UPDATE "campaign_targets"
SET "destination_id" = "channel_id"
WHERE "destination_id" IS NULL;

ALTER TABLE "campaign_targets"
ALTER COLUMN "destination_id" SET NOT NULL;

ALTER TABLE "campaign_targets"
ALTER COLUMN "channel_id" DROP NOT NULL;
