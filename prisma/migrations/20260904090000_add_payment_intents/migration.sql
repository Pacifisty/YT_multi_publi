CREATE TABLE "payment_intents" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_intent_id" TEXT,
    "email" TEXT NOT NULL,
    "purchase" JSONB NOT NULL,
    "amount_brl" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" TEXT NOT NULL,
    "checkout_url" TEXT,
    "external_reference" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "paid_at" TIMESTAMP(3),
    "fulfillment_status" TEXT NOT NULL DEFAULT 'pending',
    "fulfillment_error" TEXT,
    "fulfillment_started_at" TIMESTAMP(3),
    "fulfilled_at" TIMESTAMP(3),

    CONSTRAINT "payment_intents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_intents_provider_intent_id_key"
    ON "payment_intents"("provider_intent_id");

CREATE INDEX "payment_intents_email_created_at_idx"
    ON "payment_intents"("email", "created_at");

CREATE INDEX "payment_intents_external_reference_idx"
    ON "payment_intents"("external_reference");

CREATE INDEX "payment_intents_status_created_at_idx"
    ON "payment_intents"("status", "created_at");

CREATE INDEX "payment_intents_fulfillment_status_created_at_idx"
    ON "payment_intents"("fulfillment_status", "created_at");
