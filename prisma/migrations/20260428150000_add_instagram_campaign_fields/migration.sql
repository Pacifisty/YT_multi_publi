-- Add Instagram-specific fields to campaign_targets table
ALTER TABLE "campaign_targets" ADD COLUMN "instagram_caption" TEXT;
ALTER TABLE "campaign_targets" ADD COLUMN "instagram_share_to_feed" BOOLEAN;
