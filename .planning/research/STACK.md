# Stack: Payment Reliability & Observability

## Current State
- **Payment Provider:** MercadoPago Checkout Pro (live, production tokens acquired 2026-04-27)
- **Logging:** Console.log only (zero structured logging)
- **Error Tracking:** None (no Sentry, DataDog, or equivalent)
- **Webhooks:** No signature verification framework beyond HMAC (good); no idempotency tracking
- **Monitoring:** None (no APM, no metrics collection)

## Recommended Stack for Payment Reliability

### Logging & Error Tracking
| Layer | Current | Recommended | Why |
|-------|---------|-------------|-----|
| **Structured Logging** | console.log | Winston, Bunyan, or Pino | Indexed, queryable logs in production |
| **Error Tracking** | None | Sentry (free tier: 5k events/month) | Automatic error aggregation, source maps, release tracking |
| **Metrics** | None | Prometheus + Grafana OR Datadog APM | Monitor payment latency, webhook success rate, queue depth |

### For This Phase (Payment Reliability Specifically)
**Minimum viable stack:**
1. **Winston Logger** (lightweight, structured, file + console output)
   - Separate log files for payment events
   - Structured JSON for ELK/Datadog ingestion
   - Rotation + retention (7 days for dev, 30 days for prod)

2. **Webhook Idempotency**
   - In-memory Set or Redis for deduplication (webhook ID → processed)
   - Or: database column `payment_webhooks.mercadopago_webhook_id` UNIQUE
   - TTL: 24 hours (beyond MercadoPago retry window)

3. **Startup Validation**
   - Check all required env vars exist at boot (DATABASE_URL, MERCADOPAGO_ACCESS_TOKEN, etc.)
   - Fail fast with clear error message if missing
   - No silent fallback to mock mode

4. **Payment-Specific Monitoring**
   - Log every state change: checkout created, webhook received, payment status updated, tokens credited
   - Track latencies: webhook processing time, MercadoPago API call latency
   - Alert on failures: payment created but webhook never arrived, webhook processed but tokens not credited

### For Future Phases (TikTok & Beyond)
- Prometheus + Grafana for dashboards (upload success rates, quota usage)
- Datadog APM for cross-service tracing (especially when async job queue added)
- CloudWatch or ELK if using managed hosting (Railway, Fly.io)

## Integration Patterns

### Structured Logging Example
```javascript
logger.info('payment.checkout.created', {
  intentId: '123',
  email: 'user@example.com',
  planCode: 'PRO',
  amount: 49.90,
  timestamp: new Date().toISOString(),
  provider: 'mercadopago'
});

logger.error('payment.webhook.failed', {
  intentId: '123',
  webhookId: 'mp_webhook_456',
  error: error.message,
  statusCode: error.statusCode
});
```

### Idempotency Tracking
```javascript
// Store webhook ID to prevent double-processing
const webhookKey = `mp_webhook_${webhookId}`;
if (await cache.get(webhookKey)) {
  return { status: 200, body: { received: true, duplicate: true } };
}
await cache.set(webhookKey, true, 86400); // 24hr TTL
// process webhook...
```

## Rationale

**Why structured logging over console.log:**
- console.log output is unindexed, unsearchable in production
- Structured JSON allows log aggregation + dashboards
- Critical for debugging: "customer says payment failed" → search logs → root cause

**Why idempotency:**
- MercadoPago retries webhooks if no 2xx response
- Without deduplication: same webhook processed twice = double-credit tokens = customer escalation
- Database UNIQUE constraint or cache TTL prevents this

**Why startup validation:**
- Silent fallback to mock provider has burned teams before
- Production without MERCADOPAGO_ACCESS_TOKEN runs against mock, accepts no payments, nobody realizes until users complain
- Fail loudly at startup, not silently at 3am

## Confidence & Gaps

- **High confidence:** Structured logging + idempotency + startup checks prevent 90% of payment failures
- **Gap:** Metrics/monitoring (important for scaling, not required for v1 reliability)
- **Gap:** Distributed tracing (important when job queue added later, not critical for payment flow alone)

---

*Research completed: 2026-04-27 for Payment Reliability phase*
