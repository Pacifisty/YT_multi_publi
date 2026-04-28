-- Reconcile drift left over from commit d0350ff (schema added @default("")
-- on campaign_targets.destination_id but no migration file was generated).
ALTER TABLE "campaign_targets"
  ALTER COLUMN "destination_id" SET DEFAULT '';

-- Classify publish failures so the retry policy can short-circuit on
-- permanent errors (auth, quota, validation) instead of burning attempts.
ALTER TABLE "publish_jobs"
  ADD COLUMN "error_class" TEXT;
