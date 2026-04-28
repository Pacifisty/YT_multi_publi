---
wave: 1
depends_on: []
files_modified:
  - apps/api/src/account-plan/mock-mercadopago-adapter.ts
  - apps/api/tests/payment-e2e.test.ts
  - apps/api/src/account-plan/payment.service.ts
  - apps/api/src/account-plan/mercadopago-payment.adapter.ts
autonomous: false
---

# PLAN 04: End-to-End Testing + Timeout Handling (Wave 1)

**Status:** Ready for execution
**Effort:** 2-3 days
**Risk:** Low — testing & timeout logic, no breaking changes

## Requirements Addressed

- **PAY-06:** End-to-end payment tests — Full flow: checkout → webhook → token credit
- **PAY-07:** API timeout handling — MercadoPago API calls have 10-second timeout
- **PAY-05:** Transactional consistency — Status update + token credit grouped in transaction
- **PAY-08:** Error classification integration — Permanent vs transient errors inform retry strategy

## Objective

Implement comprehensive end-to-end payment tests covering the full flow (checkout creation → webhook processing → token credit), add 10-second timeouts to MercadoPago API calls, ensure payment status and token credit happen atomically, and integrate the existing error classifier to distinguish permanent from transient failures.

## Must-Haves

1. ✓ Full payment flow tested end-to-end: checkout → webhook → token credit
2. ✓ MercadoPago API calls timeout after 10 seconds (configurable)
3. ✓ Payment status update and token credit are transactional (both succeed or both fail)
4. ✓ Error classifier determines retry strategy (permanent errors do not retry)
5. ✓ Tests cover success path, webhook retry, timeout, and signature verification failure
6. ✓ Mock MercadoPago adapter available for testing without real credentials

## Tasks

### Task 1: Create Enhanced Mock MercadoPago Adapter for Testing

**Name:** Build `mock-mercadopago-adapter.ts` with controllable responses and delays

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/mercadopago-payment.adapter.ts` (line 1-65, createCheckout)
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/payment.service.ts` (line 64-68, PaymentProviderAdapter interface)

**Action:**
1. Create new file: `apps/api/src/account-plan/mock-mercadopago-adapter.ts`
2. Export `MockMercadoPagoPaymentProviderAdapter` implementing `PaymentProviderAdapter`:
   - Extends or implements same interface as real adapter
   - Constructor accepts options: `{ delayMs?: number; failureMode?: 'success' | 'timeout' | 'signature_invalid' }`
3. Implement `createCheckout` method:
   - If `delayMs` > 0: simulate with `await delay(delayMs)`
   - If `failureMode === 'timeout'`: throw Error("Request timeout after 10000ms")
   - Otherwise: return mock providerIntentId (e.g., `mock_mpago_${uuid}`)
4. Implement `verifyWebhook` method:
   - Parse webhook JSON
   - If `failureMode === 'signature_invalid'`: return null (signature verification failed)
   - Otherwise: return VerifiedWebhook with externalReference and status
   - Support simulating various payment statuses: 'pending', 'paid', 'failed'
5. Add test helper: `createMockWebhookHeaders(dataId: string, requestId: string): Record<string, string>`

**Acceptance Criteria:**
```bash
grep "MockMercadoPagoPaymentProviderAdapter" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/mock-mercadopago-adapter.ts
grep "failureMode" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/mock-mercadopago-adapter.ts
grep "delayMs" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/mock-mercadopago-adapter.ts
grep "createMockWebhookHeaders" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/mock-mercadopago-adapter.ts
```

---

### Task 2: Add Timeout Support to Real MercadoPago Adapter

**Name:** Implement 10-second timeout on API calls to MercadoPago

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/mercadopago-payment.adapter.ts` (line 29-65, createCheckout method)
- MercadoPago SDK docs (check if SDK supports timeout options or if we wrap with timeout)

**Action:**
1. In MercadoPagoPaymentProviderAdapter constructor (line 21):
   - Add optional `timeoutMs?: number` parameter (default 10000)
   - Store as private field: `this.timeoutMs = timeoutMs ?? 10000`
2. Create helper method `async withTimeout<T>(promise: Promise<T>): Promise<T>`:
   - Wraps promise with timeout: if promise doesn't resolve in `this.timeoutMs`, throw Error("Request timeout after Xms")
   - Use `Promise.race()` with `new Promise((_, reject) => setTimeout(() => reject(new Error(...)), ms))`
3. In `createCheckout` method (line 29):
   - Wrap `preference.create()` call with timeout:
     ```typescript
     const result = await this.withTimeout(preference.create({...}));
     ```
4. In `verifyWebhook` method (line 90):
   - Wrap `payment.get()` call with timeout:
     ```typescript
     const result = await this.withTimeout(payment.get({ id: dataIdString }));
     ```
5. Document in JSDoc: "MercadoPago API calls timeout after 10 seconds (configurable)"

**Acceptance Criteria:**
```bash
grep "withTimeout" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/mercadopago-payment.adapter.ts
grep "timeoutMs" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/mercadopago-payment.adapter.ts
grep "10000" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/mercadopago-payment.adapter.ts
grep "Request timeout" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/mercadopago-payment.adapter.ts
```

---

### Task 3: Integrate Error Classifier into Payment Service

**Name:** Wire error-classifier to distinguish permanent vs transient errors

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/campaigns/error-classifier.ts` (line 1-46)
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/payment.service.ts` (line 87-102, PaymentService)

**Action:**
1. Copy `classifyPublishError` and related functions from error-classifier.ts to create payment-specific version OR import and reuse
2. Create payment error classification utility: `apps/api/src/account-plan/payment-error-classifier.ts`:
   - Export `classifyPaymentError(error: unknown): 'permanent' | 'transient'`
   - Permanent patterns: "invalid", "unauthorized", "forbidden", "404", "not found", "quota exceeded", "invalid token", "invalid credentials"
   - Transient patterns: "timeout", "connection refused", "ECONNRESET", "ETIMEDOUT", "503", "temporarily"
3. In PaymentService.handleWebhook (line 170):
   - On error, classify with `classifyPaymentError(error)`
   - If permanent: set `errorMessage` to indicate no retry should occur
   - If transient: allow webhook retry (caller can implement retry logic)
4. In PaymentService.markStatus (line 194):
   - Accept optional `errorClass?: 'permanent' | 'transient'`
   - Store classification in payment intent for logging
5. Add method: `PaymentService.getErrorClassification(intentId: string): 'permanent' | 'transient' | null`

**Acceptance Criteria:**
```bash
grep "classifyPaymentError" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/payment-error-classifier.ts
grep "permanent" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/payment-error-classifier.ts
grep "transient" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/payment-error-classifier.ts
grep "getErrorClassification" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/payment.service.ts
```

---

### Task 4: Create End-to-End Payment Test Suite

**Name:** Full flow test: checkout → webhook → token credit

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/payment.service.ts` (full PaymentService)
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/account-plan.controller.ts` (line 211-229, webhook handler)
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/mock-mercadopago-adapter.ts` (just created)

**Action:**
1. Create test file: `apps/api/tests/payment-e2e.test.ts`
2. Set up test fixtures:
   - Create mock repository, adapter, deduplicator
   - Create PaymentService with mocks
   - Create AccountPlanService with mocks
   - Create mock webhook headers helper
3. Test 1 - Create Checkout:
   - Call `paymentService.createCheckout({ kind: 'plan', email: 'user@example.com', planDefinition: PRO_PLAN })`
   - Verify intent created with status='pending'
   - Verify providerIntentId returned
4. Test 2 - Webhook Received and Payment Status Updated:
   - Simulate webhook arrival with mock adapter
   - Call `paymentService.handleWebhook(headers, rawBody)`
   - Verify intent status changed to 'paid'
   - Verify paidAt timestamp set
5. Test 3 - Token Pack Purchase → Webhook → Token Credit:
   - Create token_pack checkout
   - Simulate webhook
   - Call `applyPaidIntent` in controller
   - Verify AccountPlan.tokens incremented
6. Test 4 - Webhook Retry Idempotency:
   - Send same webhook twice
   - Verify only first processes fully
   - Verify tokens not double-credited
7. Test 5 - Timeout Handling:
   - Create mock adapter with `delayMs: 15000` (exceeds 10s timeout)
   - Call `createCheckout`
   - Catch timeout error
   - Verify error message contains "timeout"
8. Test 6 - Signature Verification Failure:
   - Create mock adapter with `failureMode: 'signature_invalid'`
   - Call `handleWebhook` with invalid signature
   - Verify webhook rejected (returns null)
9. Test 7 - Error Classification:
   - Create payment that fails with "Invalid token" error
   - Verify classified as 'permanent'
   - Create payment that fails with "timeout" error
   - Verify classified as 'transient'

**Acceptance Criteria:**
```bash
grep "Test 1.*Checkout" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/payment-e2e.test.ts
grep "webhook.*Retry" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/payment-e2e.test.ts
grep "Timeout.*Handling" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/payment-e2e.test.ts
grep "double.*credit" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/payment-e2e.test.ts
grep "Signature.*Verification" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/payment-e2e.test.ts
npm run test -- payment-e2e.test.ts 2>&1 | grep -E "pass|fail"
```

---

### Task 5: Transactional Payment + Token Update

**Name:** Ensure payment status and token credit are atomic

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/account-plan.controller.ts` (line 359-369, applyPaidIntent)
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/account-plan.service.ts` (locate update methods)

**Action:**
1. In AccountPlanController.applyPaidIntent (line 359):
   - Wrap both operations (selectPlan OR creditTokens) in a transaction if Prisma is available
   - If Prisma: use `prisma.$transaction([ selectPlan(...), creditTokens(...) ])`
   - If in-memory: ensure both succeed or both fail (no partial success)
2. Add error handling:
   - If either selectPlan or creditTokens fails: log error, do NOT update payment status
   - Return error to webhook handler (caller decides retry)
3. Add test: Create payment → send webhook → verify both payment.status='paid' AND tokens updated in same transaction
4. Add test: Create payment → send webhook → simulate creditTokens failure → verify payment still pending (rollback)

**Acceptance Criteria:**
```bash
grep "prisma.\$transaction" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/account-plan.controller.ts
grep "transaction" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/payment-e2e.test.ts
grep "rollback" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/payment-e2e.test.ts
```

---

### Task 6: Plan Purchase End-to-End Test

**Name:** Test plan purchase (not just token packs)

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/account-plan.controller.ts` (line 359-364, selectPlan for plan purchases)

**Action:**
1. In `payment-e2e.test.ts`, add test:
   - Create checkout for 'PRO' plan
   - Simulate webhook with status='paid'
   - Call `applyPaidIntent` with plan purchase
   - Verify `selectPlan('user@example.com', 'PRO')` called
   - Verify AccountPlan.plan changed to 'PRO'
   - Verify billing dates set correctly
2. Test plan expiration scenario:
   - Create checkout for plan with 30-day duration
   - Mark webhook paid
   - Verify billingExpiresAt set to today + 30 days

**Acceptance Criteria:**
```bash
grep "plan purchase" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/payment-e2e.test.ts
grep "PRO" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/payment-e2e.test.ts
grep "selectPlan" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/payment-e2e.test.ts
grep "billingExpiresAt" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/payment-e2e.test.ts
```

---

### Task 7: Timeout Configuration Documentation

**Name:** Document timeout settings and how to configure them

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/mercadopago-payment.adapter.ts` (timeoutMs field)

**Action:**
1. In mercadopago-payment.adapter.ts constructor (line 21):
   - Add `timeoutMs?: number` parameter to `MercadoPagoPaymentAdapterOptions` interface
   - Add JSDoc comment:
     ```
     * @param timeoutMs - Timeout for MercadoPago API calls in milliseconds (default: 10000)
     ```
2. In app.ts (line 76-81, where MercadoPagoPaymentProviderAdapter is instantiated):
   - Pass timeout if available: `new MercadoPagoPaymentProviderAdapter({ accessToken, webhookSecret, timeoutMs: 10000 })`
3. Add startup log: `console.log('[api] mercadopago api timeout: 10000ms')`
4. Create deployment guide comment in app.ts:
   ```
   // MercadoPago adapter uses 10-second timeout for API calls.
   // If experiencing timeouts in high-latency environments, increase timeoutMs.
   ```

**Acceptance Criteria:**
```bash
grep "timeoutMs" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/mercadopago-payment.adapter.ts
grep "10000ms" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/app.ts
grep "timeout" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/app.ts
```

---

### Task 8: Error Classification Test Coverage

**Name:** Verify error classifier is used and tested

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/account-plan/payment-error-classifier.ts` (just created)

**Action:**
1. Create test file: `apps/api/tests/payment-error-classifier.test.ts`
2. Test 1 - Permanent errors:
   - `classifyPaymentError(new Error('Invalid token'))` → 'permanent'
   - `classifyPaymentError(new Error('Unauthorized'))` → 'permanent'
   - `classifyPaymentError(new Error('not found'))` → 'permanent'
3. Test 2 - Transient errors:
   - `classifyPaymentError(new Error('Request timeout'))` → 'transient'
   - `classifyPaymentError(new Error('ECONNRESET'))` → 'transient'
   - `classifyPaymentError(new Error('temporarily unavailable'))` → 'transient'
4. Test 3 - Unknown errors:
   - `classifyPaymentError(new Error('something weird'))` → 'transient' (default to safe retry)
5. Test 4 - No error (null/undefined):
   - `classifyPaymentError(null)` → 'transient'

**Acceptance Criteria:**
```bash
npm run test -- payment-error-classifier.test.ts 2>&1 | grep -E "pass|fail"
grep "permanent" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/payment-error-classifier.test.ts
grep "transient" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/payment-error-classifier.test.ts
```

---

## Verification Checklist

After all tasks complete:

1. Mock MercadoPago adapter created with controllable responses and delays
2. Real MercadoPago adapter supports 10-second timeout on API calls
3. Error classifier created and integrated into payment service
4. End-to-end payment test suite created with 7+ test cases
5. All payment flows tested: plan purchase, token pack, webhook retry, timeout, signature failure
6. Transaction consistency verified: payment status and token credit are atomic
7. Timeout configuration documented and logged at startup
8. Error classification tests created and passing

---

## Success Criteria (Definition of Done)

- ✓ `npm run test -- payment-e2e.test.ts` passes (all 7+ tests)
- ✓ `npm run test -- payment-error-classifier.test.ts` passes
- ✓ Full payment flow works: checkout → webhook → token credit
- ✓ Same webhook cannot be processed twice (verified via test)
- ✓ API timeout after 10 seconds (tested with mock adapter delay)
- ✓ Payment status and token count updated atomically (verified in test)
- ✓ Permanent errors classified correctly (do not retry)
- ✓ Transient errors classified correctly (allow retry)

---

## Notes

- Wave 1 of Phase 0: Payment Reliability. No deployment blockers.
- Mock adapter enables comprehensive testing without real MercadoPago credentials.
- Timeout prevents hanging on slow API responses (common in high-latency networks).
- Transactional consistency prevents state where payment is paid but tokens not credited.
- Error classification enables smart retry logic (caller can skip retries for permanent errors).
- All tests use mocks; can run in CI/CD without external dependencies.
