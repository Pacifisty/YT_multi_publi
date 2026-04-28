# Architecture: Payment Reliability

## Current Payment Flow
```
User clicks "Comprar" (Buy)
    ↓
POST /api/account/plan/checkout
    ↓
AccountPlanController.createCheckout()
    ↓
PaymentService.createCheckout()
    ↓
MercadoPagoPaymentProviderAdapter.createCheckout()
    ↓
Preference.create() [MercadoPago SDK]
    ↓
Returns: { providerIntentId, checkoutUrl }
    ↓
Frontend redirects to Mercado Pago Checkout Pro
    ↓
User pays (or cancels)
    ↓
Mercado Pago POSTs /api/account/plan/webhook
    ↓
AccountPlanController.paymentWebhook()
    ↓
PaymentService.handleWebhook()
    ↓
MercadoPagoPaymentProviderAdapter.verifyWebhook()
    ↓
fetch Payment.get() from MercadoPago [API call]
    ↓
Returns VerifiedWebhook { externalReference, status }
    ↓
AccountPlanController calls applyPaidIntent()
    ↓
AccountPlanService.selectPlan() [if plan purchase]
    ↓
Update database: AccountPlan.tokens, AccountPlan.billingExpiresAt
    ↓
Return 200 OK to Mercado Pago
```

## Reliability Layers to Add

### Layer 1: Logging (Observability)
**Insert at every state transition:**
- Checkout created → log with intentId, email, planCode, amount
- Webhook received → log webhook body + calculated signature
- Webhook verified → log status, external reference
- Payment status updated → log old status → new status, tokens credited
- Error occurred → log error type, message, context

**File:** New logger utility in `apps/api/src/common/logging.ts`
**Integration:** Inject into PaymentService, AccountPlanService, controllers

### Layer 2: Idempotency (Data Integrity)
**Insert in webhook handler:**
```
1. Extract webhookId from webhook payload
2. Check if webhookId exists in processed_webhooks table/cache
3. If exists: return 200 (already processed)
4. If not: process normally, then record webhookId → processed_webhooks
```

**File:** `apps/api/src/account-plan/payment.service.ts:handleWebhook()`
**Schema change:** Add `processed_webhooks` table OR use cache (Redis)
**Current risk:** Double-credit if webhook retried

### Layer 3: Startup Validation (Fail Fast)
**Insert in app.ts or cli.ts startup:**
```
Check:
- DATABASE_URL exists
- MERCADOPAGO_ACCESS_TOKEN exists (or explicit MOCK_PAYMENT_MODE=true)
- MERCADOPAGO_WEBHOOK_SECRET exists
- Required env vars for each integration

If missing: throw Error(clear message) → process exits before listening
```

**File:** `apps/api/src/app.ts` in `createApp()` function
**Current risk:** Payment silently disabled if token missing; nobody notices until users complain

### Layer 4: Testing (Verification)
**End-to-end payment flow test:**
1. Create a checkout (mock MercadoPago response)
2. Simulate webhook arrival (MercadoPago POSTing to /webhook)
3. Assert tokens credited
4. Assert AccountPlan updated
5. Test webhook retry (same webhook ID twice) → assert not double-credited

**File:** `tests/phase0/payment-e2e.test.ts` (new)
**Coverage:** Happy path + failure cases (invalid signature, webhook duplicate, API error)

### Layer 5: Error Classification Integration (Bonus)
**Wire existing error-classifier.ts into job retry:**
Current code has `error-classifier.ts` but doesn't use it.
Job retry logic in `ResilientJobRunner` could use classification to decide:
- `permanent` error → don't retry
- `transient` error → retry with backoff

**File:** `apps/api/src/campaigns/error-classifier.ts` (integrate into `publish-job.service.ts`)

## Data Changes Required

### New Table: `processed_webhooks`
```sql
CREATE TABLE processed_webhooks (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50),           -- 'mercadopago'
  webhook_id VARCHAR(255) UNIQUE,
  received_at TIMESTAMP,
  processed_at TIMESTAMP,
  status VARCHAR(50)              -- 'success', 'duplicate', 'error'
);
```

OR: Use Redis cache (simpler, if already available)

### Schema Update: `payment_intents`
Add logging context column (optional, for audit trail):
```sql
ALTER TABLE payment_intents ADD COLUMN processed_webhook_id VARCHAR(255);
ALTER TABLE payment_intents ADD COLUMN last_webhook_at TIMESTAMP;
```

## Build Order (Phase Dependencies)

1. **Logging setup** (independent) — Can be added without blocking other work
2. **Idempotency** (independent) — Can be added separately
3. **Startup validation** (independent) — Can be added separately
4. **Tests** (depends on above) — Write after logging + idempotency in place
5. **Error classifier** (independent) — Bonus; can be added anytime

**Recommendation:** Do all 4 in parallel; they don't depend on each other.

---

*Research completed: 2026-04-27 for Payment Reliability phase*
