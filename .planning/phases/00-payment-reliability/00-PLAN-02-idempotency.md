---
wave: 1
depends_on: []
files_modified:
  - prisma/schema.prisma
  - prisma/migrations/xxxx_add_webhook_idempotency.sql
  - apps/api/src/account-plan/webhook-deduplication.ts
  - apps/api/src/account-plan/payment.service.ts
autonomous: false
---

# PLAN 02: Webhook Idempotency (Wave 1)

**Status:** Ready for execution
**Effort:** 1 day
**Risk:** Low — adds deduplication layer before payment processing

## Requirements Addressed

- **PAY-01:** Webhook idempotency — Same webhook ID processed only once

## Objective

Implement webhook idempotency via a database table tracking processed webhook events. Before handling a webhook, check if the event has been processed; if so, return success without reprocessing. This prevents double-charging and double-crediting tokens if MercadoPago retries webhooks.

## Must-Haves

1. ✓ New database table `WebhookEvent` tracking: providerIntentId, eventType, processedAt, status
2. ✓ Before webhook processing, check if event exists in table; return early if found
3. ✓ Webhook is inserted into table BEFORE payment status is updated (idempotency key established)
4. ✓ Idempotency verified via test: send same webhook twice, only first updates payment
5. ✓ Webhook deduplication utility injectable into PaymentService

## Tasks

### Task 1: Create WebhookEvent Schema Migration

**Name:** Add `webhook_events` table to Prisma schema

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/prisma/schema.prisma` (understand existing models, id/timestamp patterns, PaymentIntent model)
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/prisma/migrations` (review migration file naming conventions and structure)

**Action:**
1. Open `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/prisma/schema.prisma`
2. Add new model at end of file:
```prisma
model WebhookEvent {
  id                String    @id @default(cuid())
  provider          String    // 'mercadopago', 'stripe', etc.
  providerEventId   String    // MercadoPago webhook ID or Stripe event ID
  externalReference String?   // Payment intent ID from our system
  eventType         String    // 'payment', 'merchant_order', etc.
  status            String    // 'processing', 'completed', 'failed'
  rawPayload        String?   // Optionally store webhook payload for debugging
  processedAt       DateTime? @map("processed_at")
  errorMessage      String?   @map("error_message")
  createdAt         DateTime  @default(now()) @map("created_at")

  @@unique([provider, providerEventId])
  @@index([externalReference])
  @@index([createdAt])
  @@map("webhook_events")
}
```
3. Create migration file: `prisma/migrations/$(date +%s)_add_webhook_idempotency.sql`
4. In migration, write raw SQL to create `webhook_events` table with same structure
5. Run: `npx prisma migrate deploy` (or `npx prisma migrate dev` in dev)

**Acceptance Criteria:**
```bash
grep -A 15 "model WebhookEvent" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/prisma/schema.prisma
grep "webhook_events" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/prisma/schema.prisma
ls /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/prisma/migrations/*_add_webhook_idempotency.sql
```

---

### Task 2: Create WebhookDeduplicator Utility

**Name:** Build `webhook-deduplication.ts` with record & check methods

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/prisma/schema.prisma` (WebhookEvent model just created)
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/payment.service.ts` (line 58-68, VerifiedWebhook structure)

**Action:**
1. Create new file: `apps/api/src/account-plan/webhook-deduplication.ts`
2. Export interface `WebhookDeduplicator`:
   - `recordWebhookEvent(provider: string, providerEventId: string, externalReference: string, eventType: string, rawPayload?: string): Promise<void>`
   - `hasProcessedEvent(provider: string, providerEventId: string): Promise<boolean>`
3. Export `PrismaWebhookDeduplicator` class implementing `WebhookDeduplicator`:
   - Takes `prisma: PrismaClient` in constructor
   - `recordWebhookEvent`: upsert WebhookEvent with status='processing', handle unique constraint gracefully
   - `hasProcessedEvent`: check if event exists by (provider, providerEventId) tuple
4. Both methods must be idempotent (safe to call multiple times)
5. Handle race conditions: if two webhook requests arrive simultaneously for same providerEventId:
   - First wins (inserts with status='processing')
   - Second reads existing record and returns true (already processing/processed)

**Acceptance Criteria:**
```bash
grep "recordWebhookEvent" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/webhook-deduplication.ts
grep "hasProcessedEvent" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/webhook-deduplication.ts
grep "export.*WebhookDeduplicator" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/webhook-deduplication.ts
grep "@@unique.*provider.*providerEventId" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/prisma/schema.prisma
```

---

### Task 3: Inject Deduplicator into PaymentService

**Name:** Wire webhook deduplication into handleWebhook method

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/payment.service.ts` (line 170-192, handleWebhook method)
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/webhook-deduplication.ts` (just created)

**Action:**
1. Add to `PaymentServiceOptions` interface (line 78-85):
   - `webhookDeduplicator?: WebhookDeduplicator`
2. Add to `PaymentService` constructor:
   - Accept and store `webhookDeduplicator` option
   - Default to null if not provided
3. In `handleWebhook` method (line 170):
   - After webhook verification succeeds (line 175):
     - Get providerEventId from verified webhook (may need to extract from headers or request context)
     - Call `await this.webhookDeduplicator?.hasProcessedEvent(this.provider.name, providerEventId)`
     - If returns true: log and return the existing intent (avoid reprocessing)
     - If returns false/null: continue with normal processing
4. After intent is updated (line 187-191):
   - Call `await this.webhookDeduplicator?.recordWebhookEvent(this.provider.name, providerEventId, intent.id, 'payment')`
5. Add to method signature comment: "Returns early if webhook already processed (idempotency)"

**Acceptance Criteria:**
```bash
grep "webhookDeduplicator" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/payment.service.ts
grep "hasProcessedEvent" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/payment.service.ts
grep "recordWebhookEvent" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/payment.service.ts
grep -A 5 "handleWebhook.*idempotency" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/payment.service.ts
```

---

### Task 4: Update MercadoPago Adapter to Include Event ID

**Name:** Extract and pass webhook event ID through to deduplication

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/mercadopago-payment.adapter.ts` (line 67-100, verifyWebhook return type)
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/payment.service.ts` (line 58-62, VerifiedWebhook interface)

**Action:**
1. Extend `VerifiedWebhook` interface to include:
   - `providerEventId?: string` (MercadoPago webhook event ID from `x-request-id` header or parsed payload)
2. In `MercadoPagoPaymentProviderAdapter.verifyWebhook` (line 67):
   - Extract providerEventId from `normalized['x-request-id']` (line 83)
   - Return it in VerifiedWebhook object: `{ providerEventId: requestId, externalReference: ..., status: ... }`
3. Update comment at line 73: "Webhook event is identified by x-request-id header for deduplication"

**Acceptance Criteria:**
```bash
grep "providerEventId" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/mercadopago-payment.adapter.ts
grep "x-request-id" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/mercadopago-payment.adapter.ts
grep "VerifiedWebhook" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/payment.service.ts | grep "providerEventId"
```

---

### Task 5: Create Idempotency Test

**Name:** Verify same webhook cannot be processed twice

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/webhook-deduplication.ts` (just created)
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/payment.service.ts` (handleWebhook method)

**Action:**
1. Create test file: `apps/api/tests/idempotency.test.ts`
2. Test 1: Create payment intent, get its ID
3. Test 2: Simulate first webhook arrival:
   - Call `paymentService.handleWebhook(headers, rawBody)` with providerEventId='webhook-123'
   - Verify intent.status changed to 'paid'
   - Verify WebhookEvent created with status='processing'
4. Test 3: Simulate second webhook arrival (same providerEventId):
   - Call `paymentService.handleWebhook(headers, rawBody)` again with same providerEventId
   - Verify deduplicator returns early (no duplicate payment processing)
   - Verify intent.status is still 'paid' (not changed again)
   - Verify only ONE WebhookEvent row exists for this providerEventId
5. Test 4: Verify tokens not double-credited:
   - Create a token_pack payment
   - Send webhook twice
   - Check AccountPlan.tokens only incremented once (not twice)

**Acceptance Criteria:**
```bash
grep "idempotency" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/idempotency.test.ts
grep "same webhook" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/idempotency.test.ts
grep "double.*credit" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/idempotency.test.ts
npm run test -- idempotency.test.ts 2>&1 | grep -E "pass|fail"
```

---

### Task 6: Update App Initialization to Inject Deduplicator

**Name:** Wire WebhookDeduplicator into PaymentService at app startup

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/app.ts` (line 66-95, app creation and PaymentService instantiation)
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/webhook-deduplication.ts` (just created)

**Action:**
1. In `createApp` function (line 66):
   - After prisma is available, instantiate `webhookDeduplicator = new PrismaWebhookDeduplicator(prisma)` (if prisma is used)
   - Alternatively, wrap in try-catch: if prisma unavailable, set to null (gracefully degrade)
2. Pass to PaymentService options (line 84-89):
   - Add `webhookDeduplicator` to the constructor call
3. Log at startup (similar to line 83):
   - Add: `console.log('[api] webhook deduplication: enabled')`  if deduplicator exists, else 'disabled'

**Acceptance Criteria:**
```bash
grep "webhookDeduplicator" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/app.ts
grep "PrismaWebhookDeduplicator" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/app.ts
grep "webhook deduplication" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/app.ts
```

---

### Task 7: Idempotency Database Query Documentation

**Name:** Document how to query idempotency table in production

**Read First:**
- (No files, documentation task)

**Action:**
1. Create comment block in `webhook-deduplication.ts` with SQL examples:
   - Find all processed webhooks: `SELECT * FROM webhook_events WHERE status = 'completed' ORDER BY created_at DESC LIMIT 100`
   - Find webhooks for a specific payment: `SELECT * FROM webhook_events WHERE external_reference = 'pay_xxxxx'`
   - Find duplicate webhook attempts: `SELECT provider, provider_event_id, COUNT(*) FROM webhook_events GROUP BY provider, provider_event_id HAVING COUNT(*) > 1`
2. Add to test file header: "To verify idempotency in production: SELECT COUNT(DISTINCT provider_event_id) FROM webhook_events WHERE external_reference = 'pay_xxxxx' (should be 1)"

**Acceptance Criteria:**
```bash
grep -A 3 "Find all processed webhooks" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/webhook-deduplication.ts
grep "SELECT.*webhook_events" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/idempotency.test.ts
```

---

## Verification Checklist

After all tasks complete:

1. WebhookEvent table created in Prisma schema and migrations applied
2. WebhookDeduplicator utility created with recordWebhookEvent and hasProcessedEvent methods
3. PaymentService.handleWebhook checks deduplicator before processing
4. MercadoPago adapter extracts and returns providerEventId
5. Same webhook (same providerEventId) cannot be processed twice (verified via test)
6. Tokens not double-credited on webhook retry
7. Deduplicator injected at app startup
8. SQL queries documented for production debugging

---

## Success Criteria (Definition of Done)

- ✓ `npm run test -- idempotency.test.ts` passes
- ✓ Same webhook cannot be processed twice (second call returns early)
- ✓ WebhookEvent table tracks all webhook attempts
- ✓ Tokens not double-credited: token count increments only once even with duplicate webhooks
- ✓ Duplicate webhook attempt visible in `webhook_events` table
- ✓ App logs "webhook deduplication: enabled" at startup (if Prisma available)

---

## Notes

- Wave 1 of Phase 0: Payment Reliability. No deployment blockers.
- Deduplication must happen BEFORE payment state update (at-most-once semantics).
- Uses database unique constraint on (provider, providerEventId) for race condition safety.
- Graceful degradation: if Prisma unavailable, deduplicator is null and webhook still processes (just without dedup).
- MercadoPago sends x-request-id header which uniquely identifies each webhook delivery.
