ALTER TABLE "admin_users"
  ADD COLUMN "account_deletion_requested_at" TIMESTAMP(3),
  ADD COLUMN "account_deactivation_scheduled_at" TIMESTAMP(3),
  ADD COLUMN "account_deletion_scheduled_at" TIMESTAMP(3);
