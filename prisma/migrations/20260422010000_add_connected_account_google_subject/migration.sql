ALTER TABLE "connected_accounts"
ADD COLUMN "google_subject" TEXT;

CREATE UNIQUE INDEX "connected_accounts_provider_google_subject_key"
ON "connected_accounts"("provider", "google_subject");
