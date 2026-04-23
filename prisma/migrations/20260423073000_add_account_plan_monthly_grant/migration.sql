ALTER TABLE "account_plans"
ADD COLUMN IF NOT EXISTS "last_monthly_grant_at" TIMESTAMP(3);
