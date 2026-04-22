ALTER TABLE "connected_accounts"
ADD COLUMN "owner_email" TEXT;

ALTER TABLE "media_assets"
ADD COLUMN "owner_email" TEXT;

ALTER TABLE "campaigns"
ADD COLUMN "owner_email" TEXT;

WITH "primary_owner" AS (
  SELECT "email"
  FROM "admin_users"
  ORDER BY "created_at" ASC, "email" ASC
  LIMIT 1
)
UPDATE "connected_accounts"
SET "owner_email" = (SELECT "email" FROM "primary_owner")
WHERE "owner_email" IS NULL
  AND EXISTS (SELECT 1 FROM "primary_owner");

WITH "primary_owner" AS (
  SELECT "email"
  FROM "admin_users"
  ORDER BY "created_at" ASC, "email" ASC
  LIMIT 1
)
UPDATE "media_assets"
SET "owner_email" = (SELECT "email" FROM "primary_owner")
WHERE "owner_email" IS NULL
  AND EXISTS (SELECT 1 FROM "primary_owner");

WITH "primary_owner" AS (
  SELECT "email"
  FROM "admin_users"
  ORDER BY "created_at" ASC, "email" ASC
  LIMIT 1
)
UPDATE "campaigns"
SET "owner_email" = (SELECT "email" FROM "primary_owner")
WHERE "owner_email" IS NULL
  AND EXISTS (SELECT 1 FROM "primary_owner");

DROP INDEX IF EXISTS "connected_accounts_provider_google_subject_key";

CREATE UNIQUE INDEX "connected_accounts_provider_google_subject_owner_email_key"
ON "connected_accounts"("provider", "google_subject", "owner_email");

CREATE INDEX "connected_accounts_owner_email_idx"
ON "connected_accounts"("owner_email");

CREATE INDEX "media_assets_owner_email_idx"
ON "media_assets"("owner_email");

CREATE INDEX "campaigns_owner_email_idx"
ON "campaigns"("owner_email");
