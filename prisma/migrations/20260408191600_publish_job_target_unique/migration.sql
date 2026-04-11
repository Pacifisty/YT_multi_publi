-- Enforce one publish job per campaign target so scheduling/restarts cannot
-- create duplicate publish records for the same target.
DROP INDEX IF EXISTS "publish_jobs_campaign_target_id_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "publish_jobs_campaign_target_id_key"
ON "publish_jobs" ("campaign_target_id");
