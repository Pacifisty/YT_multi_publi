# Features: Payment Reliability

## Table Stakes (Users Expect These)
- ✓ **Payment completes successfully** — User pays, system credits tokens, no errors
- ✓ **Payment failure is diagnosed** — Error message tells user what went wrong
- ✓ **Webhook is processed once** — Payment confirmed once, not double-charged
- ✓ **System recovers from transient failures** — Network hiccup doesn't lose payment

## Differentiators (Competitive Advantage)
- **Failed payment debugging** — Operator can see full webhook history + payment state (logs, retry count)
- **Automated payment reconciliation** — Nightly job verifies: "all webhooks processed, all tokens credited, nothing dangling"
- **Payment flow tracing** — Follow a payment from checkout creation → webhook receipt → token credit in one view

## Anti-Features (Don't Build)
- Complex retry logic with exponential backoff (current transient/permanent classification is enough)
- Payment escrow/holds (MercadoPago handles this; don't re-implement)
- Partial refunds (out of scope; manual support handles edge cases)
- Subscription billing (one-time payment for plans is correct for v1)

## Implementation Complexity

| Feature | Complexity | Why |
|---------|-----------|-----|
| Structured logging | **Low** | Add Winston, log to file, done |
| Webhook idempotency | **Low** | Add UNIQUE constraint or cache, check in handler |
| Startup validation | **Low** | Read env vars, throw if missing |
| End-to-end payment tests | **Medium** | Mock MercadoPago, simulate checkout → webhook → token credit |
| Error classification integration | **Medium** | Wire existing error-classifier.ts into retry logic |

## Dependencies

**Idempotency depends on:** none (independent)
**Logging depends on:** none (independent)
**Startup validation depends on:** none (independent)
**Tests depend on:** Structured logging already in place (good practices to test)
**Error classification depends on:** none (can be bolted on independently)

---

*Research completed: 2026-04-27 for Payment Reliability phase*
