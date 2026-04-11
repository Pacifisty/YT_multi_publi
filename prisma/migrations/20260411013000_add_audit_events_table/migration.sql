-- Persist campaign audit trail events for operational history and dashboard/reporting.
CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "actor_email" TEXT NOT NULL,
  "campaign_id" TEXT NOT NULL,
  "target_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_events_campaign_id_created_at_idx"
ON "audit_events" ("campaign_id", "created_at");

CREATE INDEX IF NOT EXISTS "audit_events_created_at_idx"
ON "audit_events" ("created_at");

