-- Add TikTok-specific fields to campaign_targets table
ALTER TABLE "campaign_targets" ADD COLUMN "tiktok_privacy_level" TEXT;
ALTER TABLE "campaign_targets" ADD COLUMN "tiktok_disable_comment" BOOLEAN;
ALTER TABLE "campaign_targets" ADD COLUMN "tiktok_disable_duet" BOOLEAN;
ALTER TABLE "campaign_targets" ADD COLUMN "tiktok_disable_stitch" BOOLEAN;

-- Add index on connected_account_id for faster TikTok account lookups
CREATE INDEX "campaign_targets_connected_account_id_idx" ON "campaign_targets"("connected_account_id");
