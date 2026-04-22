-- AlterTable
ALTER TABLE "admin_users"
ADD COLUMN "full_name" TEXT,
ADD COLUMN "google_subject" TEXT,
ADD COLUMN "plan_selection_completed" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "password_hash" DROP NOT NULL;

-- Preserve access for any pre-existing users created before plan onboarding existed.
UPDATE "admin_users"
SET "plan_selection_completed" = true
WHERE "plan_selection_completed" = false;

-- CreateTable
CREATE TABLE "account_plans" (
    "email" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "last_daily_visit_at" TIMESTAMP(3),
    "billing_started_at" TIMESTAMP(3),
    "billing_expires_at" TIMESTAMP(3),
    "selected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_plans_pkey" PRIMARY KEY ("email")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_google_subject_key" ON "admin_users"("google_subject");
