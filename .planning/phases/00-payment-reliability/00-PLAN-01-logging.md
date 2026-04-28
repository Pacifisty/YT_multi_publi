---
wave: 1
depends_on: []
files_modified:
  - apps/api/src/common/payment-logger.ts
  - apps/api/src/account-plan/payment.service.ts
  - apps/api/src/account-plan/account-plan.controller.ts
  - apps/api/src/account-plan/mercadopago-payment.adapter.ts
  - apps/api/src/account-plan/account-plan.service.ts
autonomous: false
---

# PLAN 01: Logging Setup (Wave 1)

**Status:** Ready for execution
**Effort:** 1-2 days
**Risk:** Low — pure observability layer, no payment flow changes

## Requirements Addressed

- **PAY-02:** Structured logging — All payment events logged searchably
- **PAY-06:** End-to-end payment tests — Diagnostic logs enable flow validation

## Objective

Create a centralized payment logging utility that captures all payment state transitions (intent creation, webhook received, status updated, tokens credited) with structured fields (intentId, email, status, provider, error) searchable by intent ID or user email.

## Must-Haves

1. ✓ Payment logger utility created with structured fields: intentId, email, status, provider, timestamp, errorMessage
2. ✓ All payment state transitions logged: checkout creation → webhook receipt → status update → token credit
3. ✓ Logs are searchable by intentId and email (structured output, no unstructured text)
4. ✓ Error messages and retry context captured (provider error, MERCADOPAGO_WEBHOOK_SECRET missing)
5. ✓ Log output does not expose secrets (access tokens, webhook secrets redacted)

## Tasks

### Task 1: Create Payment Logger Utility

**Name:** Create `payment-logger.ts` with structured logging interface

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/payment.service.ts` (line 1-50, understand PaymentIntent structure)
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/mercadopago-payment.adapter.ts` (line 67-100, webhook processing context)

**Action:**
1. Create new file: `apps/api/src/common/payment-logger.ts`
2. Export `PaymentLogger` class with methods:
   - `logCheckoutCreated(intentId: string, email: string, planOrPackId: string, amountBrl: number): void`
   - `logWebhookReceived(intentId: string, provider: string, rawBodySize: number): void`
   - `logStatusUpdated(intentId: string, oldStatus: string, newStatus: string, provider: string): void`
   - `logTokensCredited(email: string, tokens: number, intentId: string): void`
   - `logError(intentId: string, scope: string, error: Error | string, context?: Record<string, any>): void`
3. Each method must log with structured JSON fields: `{ timestamp, intentId, email, status, provider, scope, message }`
4. Use `console.log(JSON.stringify({...}))` for output (simple, machine-readable)
5. Redact secrets in any logged context: strip MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_WEBHOOK_SECRET, any token/key
6. Export singleton instance: `export const paymentLogger = new PaymentLogger()`

**Acceptance Criteria:**
```bash
grep -r "paymentLogger\\.logCheckoutCreated" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/
grep -r "logStatusUpdated.*oldStatus.*newStatus" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/common/payment-logger.ts
grep -r "logTokensCredited.*email.*tokens" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/common/payment-logger.ts
grep "timestamp" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/common/payment-logger.ts
```

---

### Task 2: Log Checkout Creation in PaymentService

**Name:** Inject logging on checkout creation

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/payment.service.ts` (line 104-160, createCheckout method)
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/common/payment-logger.ts` (just created)

**Action:**
1. Import `paymentLogger` at top of payment.service.ts
2. In `createCheckout` method, after intent is saved (line 154):
   - Call `paymentLogger.logCheckoutCreated(intent.id, intent.email, extractPurchaseId(intent.purchase), intent.amountBrl)`
   - Create helper `extractPurchaseId(purchase)` that returns plan code or pack ID
3. In `handleWebhook` method (line 170), after webhook is verified:
   - Call `paymentLogger.logWebhookReceived(intent.id, intent.provider, rawBody.length)`
4. In `markStatus` method (line 194), after update succeeds:
   - Call `paymentLogger.logStatusUpdated(id, (before)status, status, provider)`

**Acceptance Criteria:**
```bash
grep "paymentLogger.logCheckoutCreated" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/payment.service.ts
grep "paymentLogger.logWebhookReceived" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/payment.service.ts
grep "paymentLogger.logStatusUpdated" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/payment.service.ts
```

---

### Task 3: Log Webhook Processing in MercadoPago Adapter

**Name:** Inject logging on webhook signature verification and payment fetch

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/mercadopago-payment.adapter.ts` (line 67-100, verifyWebhook method)

**Action:**
1. Import `paymentLogger` at top of mercadopago-payment.adapter.ts
2. In `verifyWebhook` method:
   - If signature verification fails (line 85): `paymentLogger.logError(dataIdString || 'unknown', 'webhook_signature', 'Invalid or missing signature')`
   - If signature verification succeeds: `paymentLogger.logWebhookReceived(externalReference || providerIntentId || dataIdString, 'mercadopago', rawBody.length)`
   - If payment fetch fails (line 91): `paymentLogger.logError(dataIdString, 'payment_fetch', 'MercadoPago API returned null')`

**Acceptance Criteria:**
```bash
grep "paymentLogger.logError.*webhook_signature" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/mercadopago-payment.adapter.ts
grep "paymentLogger.logWebhookReceived" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/mercadopago-payment.adapter.ts
```

---

### Task 4: Log Token Credit in AccountPlanController

**Name:** Inject logging when tokens are credited after paid webhook

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/account-plan.controller.ts` (line 359-369, applyPaidIntent method)
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/account-plan.service.ts` (locate creditTokens method)

**Action:**
1. Import `paymentLogger` at top of account-plan.controller.ts
2. In `applyPaidIntent` method, after token credit call (after line 367):
   - Call `paymentLogger.logTokensCredited(intent.email, intent.purchase.tokens, intent.id)` 
   - Only logs for token_pack purchases (check `intent.purchase.kind === 'token_pack'`)
3. In `applyPaidIntent` method, catch any errors and call:
   - `paymentLogger.logError(intent.id, 'apply_paid_intent', error, { email: intent.email, purchaseKind: intent.purchase.kind })`

**Acceptance Criteria:**
```bash
grep "paymentLogger.logTokensCredited" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/account-plan.controller.ts
grep "paymentLogger.logError.*apply_paid_intent" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/account-plan.controller.ts
```

---

### Task 5: Log Webhook Receipt in AccountPlanController

**Name:** Log all webhook receive attempts (before & after processing)

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/account-plan.controller.ts` (line 211-229, paymentWebhook method)

**Action:**
1. Import `paymentLogger` at top of account-plan.controller.ts
2. At start of `paymentWebhook` method (before handleWebhook call):
   - Call `paymentLogger.logWebhookReceived('webhook-in-progress', 'unknown', JSON.stringify(request.body).length)`
3. After handleWebhook succeeds (line 218), if updated:
   - Call `paymentLogger.logStatusUpdated(updated.id, 'unknown', updated.status, updated.provider)` 
4. In catch block (line 223), call:
   - `paymentLogger.logError('unknown-webhook', 'webhook_handler', error)`

**Acceptance Criteria:**
```bash
grep "paymentLogger.logWebhookReceived.*webhook-in-progress" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/account-plan.controller.ts
grep "paymentLogger.logError.*webhook_handler" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/account-plan.controller.ts
```

---

### Task 6: Create Payment Logger Test

**Name:** Verify logger output is structured and searchable

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/common/payment-logger.ts` (just created)

**Action:**
1. Create new test file: `apps/api/tests/payment-logger.test.ts`
2. Test 1: Log checkout creation → verify JSON output includes `intentId`, `email`, `status: 'pending'`, `scope: 'checkout'`
3. Test 2: Log webhook received → verify JSON includes `scope: 'webhook_received'`, `provider: 'mercadopago'`
4. Test 3: Log status update → verify JSON includes `oldStatus`, `newStatus`, both in output
5. Test 4: Log error with context → verify `logError` output includes `scope`, `message`, `intentId`, and custom context fields
6. Test 5: Redaction verification → call `logError` with `accessToken: 'secret'` in context, verify output does NOT contain the literal token value

**Acceptance Criteria:**
```bash
grep -c "JSON.stringify" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/payment-logger.test.ts
grep "paymentLogger.logCheckoutCreated" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/payment-logger.test.ts
grep "intentId.*email.*scope" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/payment-logger.test.ts
grep "redact" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/payment-logger.test.ts
```

---

### Task 7: Validate Log Output Format

**Name:** Confirm log output is machine-readable and grep-searchable

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/common/payment-logger.ts` (log output format)

**Action:**
1. Run: `npm run test -- payment-logger.test.ts 2>&1 | grep -E '{"intentId|{"timestamp'`
2. Verify each log line is valid JSON (not text + JSON)
3. Create a small integration test that calls `paymentLogger.logCheckoutCreated` and verifies:
   - Output is parseable as JSON
   - Can be searched with `grep "pay_.*" | jq '.intentId'`
4. Document in test comments: "All logs are JSON-per-line to allow `grep | jq` searches"

**Acceptance Criteria:**
```bash
npm run test -- payment-logger.test.ts
grep "Valid JSON" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/payment-logger.test.ts
```

---

## Verification Checklist

After all tasks complete:

1. Payment logger file exists: `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/common/payment-logger.ts`
2. All payment state transitions log: checkout, webhook, status update, token credit
3. At least 5 log injection points across payment flow:
   - PaymentService.createCheckout
   - PaymentService.handleWebhook
   - PaymentService.markStatus
   - MercadoPagoPaymentProviderAdapter.verifyWebhook
   - AccountPlanController.applyPaidIntent
4. Logger test file created and all tests pass
5. Logs are JSON-per-line, queryable by intentId and email
6. No secrets in log output (access tokens, webhook secrets redacted)

---

## Success Criteria (Definition of Done)

- ✓ `npm run test -- payment-logger.test.ts` passes
- ✓ Payment flow can be traced via logs: `grep "pay_xxxxx" <app.log> | jq .`
- ✓ Same webhook can be found in logs by email: `grep "user@example.com" <app.log> | jq .intentId`
- ✓ Error context logged with scope (webhook_signature, payment_fetch, apply_paid_intent, etc.)
- ✓ Log output does not contain MERCADOPAGO_ACCESS_TOKEN or MERCADOPAGO_WEBHOOK_SECRET

---

## Notes

- Wave 1 of Phase 0: Payment Reliability. No deployment blockers.
- Logging setup enables all downstream plans (idempotency, testing, error diagnosis).
- Pure observability layer — does not change payment processing logic or database schema.
- Use JSON output, not fancy formatting — enables grep + jq workflows and log aggregation.
