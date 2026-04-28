# Pitfalls: Payment Reliability

## Pitfall 1: Webhook Double-Processing

**What it looks like:** Same webhook arrives twice (network retry, processing error recovery), payment system processes it twice → user charged twice / tokens credited twice.

**Why it happens:** No idempotency key tracking. MercadoPago retries webhooks if no 2xx response within timeout. If handler crashes after processing but before responding, retry looks like new webhook.

**Prevention strategy:**
- ✓ Extract webhook ID from payload
- ✓ Store in database/cache: "webhook ID 123 processed at [timestamp]"
- ✓ Check before processing: if already processed, return 200 immediately
- ✓ TTL: Keep records for 24 hours (beyond MercadoPago's retry window)

**Early detection:** Log shows "webhook received → webhook processed → webhook received (same ID)" in quick succession.

**Phase:** This must be in Payment Reliability phase (Phase 0). Critical before public launch.

---

## Pitfall 2: Silent Payment Failures

**What it looks like:** User completes payment, sees "success," leaves. Actually: webhook never arrived, payment incomplete, tokens not credited. User discovers later when trying to publish.

**Why it happens:** No logging. No way to trace payment from creation → webhook → completion. Errors happen in silence.

**Prevention strategy:**
- ✓ Log every webhook received with timestamp + status
- ✓ Log every status change in AccountPlan
- ✓ Log MercadoPago API errors with context
- ✓ Search logs by intentId or email to trace full payment journey
- ✓ Alert on: "checkout created but webhook never arrived within 1 hour"

**Early detection:** Query: `grep "intentId=123" logs/*` should show full trace.

**Phase:** Logging setup must be in Phase 0. Non-negotiable for production.

---

## Pitfall 3: Configuration Creep (Silent Fallback to Mock)

**What it looks like:** Production environment missing `MERCADOPAGO_ACCESS_TOKEN`, system silently initializes mock payment adapter, accepts no real payments, operates for hours until someone notices.

**Why it happens:** Current code: if no token provided, PaymentService uses mock provider. Works great for testing; catastrophic for production (payment system is down, nobody notices).

**Prevention strategy:**
- ✓ At app startup, validate all required env vars exist
- ✓ If production mode + MERCADOPAGO_ACCESS_TOKEN missing: throw Error with clear message
- ✓ Never silently degrade to mock in production
- ✓ If you want optional integration: explicit flag `ENABLE_MOCK_PAYMENTS=true`

**Early detection:** Startup logs should say "payment provider: mercadopago" or "payment provider: mock (explicit)". If mock appears in production, that's a config error.

**Phase:** Startup validation must be in Phase 0.

---

## Pitfall 4: Webhook Signature Verification Bypass

**What it looks like:** Attacker crafts fake webhook with empty signature, system processes it as valid, credits tokens to fake account.

**Why it happens:** Current code does check signature, which is good. But don't remove it in future "for debugging" without adding it back. And ensure MERCADOPAGO_WEBHOOK_SECRET is actually set.

**Prevention strategy:**
- ✓ Always verify HMAC signature before processing
- ✓ Use `timingSafeEqual` (already done in codebase ✓)
- ✓ Validate webhook_secret is configured
- ✓ Log if signature validation fails

**Early detection:** If webhook handler starts logging "invalid signature" frequently, investigate configuration.

**Phase:** Already done in current code. Maintain in Phase 0.

---

## Pitfall 5: Missing Token Credit After Status Update

**What it looks like:** MercadoPago confirms payment ("status: approved"), AccountPlan updates, but `tokens` field doesn't increase. User sees payment successful but can't publish.

**Why it happens:** Transactional error. Payment status changed, but token credit failed (DB full, constraint violated, etc.). Partial state.

**Prevention strategy:**
- ✓ Group status update + token credit in database transaction
- ✓ If either fails, both rollback
- ✓ Log transaction success/failure
- ✓ If rollback happens, webhook handler returns 500 (MercadoPago retries)

**Code pattern:**
```javascript
await prisma.$transaction([
  prisma.paymentIntent.update({ id, status: 'paid' }),
  prisma.accountPlan.update({ email, tokens: { increment: 100 } })
]);
```

**Early detection:** Search logs for "payment updated" without matching "tokens credited" within same transaction.

**Phase:** Verify in Phase 0 tests. Test both happy path and partial failure scenarios.

---

## Pitfall 6: Webhook Processing Timeout

**What it looks like:** Webhook received, processing takes >30s (slow DB query, MercadoPago API timeout), MercadoPago times out waiting for response, retries webhook.

**Why it happens:** No timeout on MercadoPago API call. If their servers are slow (rare but happens), webhook handler hangs.

**Prevention strategy:**
- ✓ Add 10-second timeout to MercadoPago API calls
- ✓ If timeout: log error, return 500, let MercadoPago retry
- ✓ Monitor webhook processing latency (should be <1 second)

**Early detection:** If webhook handler logs "MercadoPago API timeout" repeatedly, investigate their status page.

**Phase:** Add in Phase 0 via structured logging + monitoring setup.

---

## Pitfall 7: Forgotten Error Classification

**What it looks like:** Job publishing fails for transient reason (network blip), system retries 3x and gives up instead of exponential backoff. User publishes again, rate-limits hit.

**Why it happens:** Current error-classifier.ts exists but isn't integrated. Job retry logic doesn't use it. Every error treated the same (3 retries, done).

**Prevention strategy:**
- ✓ Integrate error-classifier.ts into RetryPolicy
- ✓ Classify errors: `permanent` (401, quotaExceeded, validation error) vs `transient` (network timeout, 500)
- ✓ Permanent → no retry
- ✓ Transient → retry with exponential backoff

**Early detection:** Job logs show "giving up after 3 attempts" on a validation error (should be immediate fail, not 3 retries).

**Phase:** Bonus work for Phase 0 if time permits. Not critical (basic retries work), but reduces wasted quota.

---

## Pitfall 8: Missing Secrets in Logs

**What it looks like:** Logs accidentally contain `MERCADOPAGO_ACCESS_TOKEN` or webhook secrets in plaintext. Committed to repo or visible in production logs.

**Why it happens:** Logging webhook body without sanitizing, or logging error messages that contain secrets.

**Prevention strategy:**
- ✓ Sanitize logs: never log full headers, tokens, API keys
- ✓ Log only: `webhookId`, `status`, `error`, not the raw payload
- ✓ Review log output before committing to ensure no secrets
- ✓ Use log masking library if complex (bunyan has this built-in)

**Early detection:** Grep logs for patterns: `sk-.*`, `AKIA.*`, `ghp_.*` (API key patterns).

**Phase:** Code review in Phase 0 before committing.

---

## Summary: Phase 0 Checklist

| Pitfall | Fix | Phase | Critical |
|---------|-----|-------|----------|
| Double-processing webhook | Idempotency key tracking | 0 | ✓ Yes |
| Silent failures | Structured logging | 0 | ✓ Yes |
| Config creep | Startup validation | 0 | ✓ Yes |
| Webhook forgery | Signature verification | 0 | ✓ Already done |
| Partial credit | Transactional updates | 0 | ✓ Yes (verify) |
| Processing timeout | Add API timeout + monitoring | 0 | ⚠ Important |
| Forgotten classification | Integrate error-classifier | 0 | — Bonus |
| Secrets in logs | Sanitize logs | 0 | ✓ Code review |

---

*Research completed: 2026-04-27 for Payment Reliability phase*
