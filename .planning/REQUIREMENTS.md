# Requirements: YT Multi-Publisher

**Defined:** 2026-04-27  
**Core Value:** Users can publish to multiple platforms at once instead of manually uploading to each — eliminating repetitive work that scales badly with each new channel.

## v1 Requirements (Current Phase: Payment Reliability)

### Payment Reliability

- [ ] **PAY-01**: Webhook idempotency — Same webhook ID processed only once (prevent double-credit)
- [ ] **PAY-02**: Structured logging — All payment events logged searchably (checkout created, webhook received, status updated, tokens credited)
- [ ] **PAY-03**: Startup validation — App fails at boot if required env vars missing (DATABASE_URL, MERCADOPAGO_ACCESS_TOKEN, WEBHOOK_SECRET)
- [ ] **PAY-04**: Webhook signature verification — Confirm webhook authenticity before processing (already implemented, verify works)
- [ ] **PAY-05**: Transactional consistency — Status update + token credit grouped in transaction (prevent partial updates)
- [ ] **PAY-06**: End-to-end payment tests — Full flow: checkout creation → webhook receipt → token credit (mock MercadoPago)
- [ ] **PAY-07**: API timeout handling — MercadoPago API calls have 10-second timeout
- [ ] **PAY-08**: Error classification integration — Permanent vs transient errors inform job retry strategy (bonus, if time permits)

### YouTube Publishing (Validated - Existing)

- ✓ **YT-01**: Users can upload videos to YouTube channels
- ✓ **YT-02**: OAuth connection for multiple YouTube accounts per user
- ✓ **YT-03**: Media management (upload, organize, store assets)
- ✓ **YT-04**: Campaign scheduling with per-channel targeting
- ✓ **YT-05**: Campaign publishing with resumable upload

### Authentication (Validated - Existing)

- ✓ **AUTH-01**: Email/password sign up and login
- ✓ **AUTH-02**: Google OAuth integration
- ✓ **AUTH-03**: Session management

### Subscription Plans (Validated - Existing)

- ✓ **PLAN-01**: BASIC/PRO/PREMIUM tier definitions with token limits
- ✓ **PLAN-02**: MercadoPago Checkout Pro integration
- ✓ **PLAN-03**: Plan selection and token credit

## v2 Requirements (Deferred)

### TikTok Publishing
- **TIK-01**: TikTok resumable upload worker
- **TIK-02**: TikTok account connection (OAuth)
- **TIK-03**: Public media URL generation for TikTok
- **TIK-04**: Campaign targeting for TikTok

### Instagram Publishing
- **IG-01**: Instagram Reels upload
- **IG-02**: Instagram account connection (OAuth)
- **IG-03**: Campaign targeting for Instagram

### Infrastructure & Operations
- **INFRA-01**: Production hosting (Railway or Fly.io)
- **INFRA-02**: Storage backend (Cloudflare R2 or Backblaze B2)
- **INFRA-03**: Error tracking (Sentry or DataDog)
- **INFRA-04**: Metrics/monitoring (Prometheus + Grafana or DataDog)

### User Experience
- **UX-01**: Email notifications (payment confirmation, publish status)
- **UX-02**: Analytics dashboard (videos published, publish success rate)
- **UX-03**: Failed job dashboard (diagnose why publish failed)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Advanced retry policies with exponential backoff | Current transient/permanent split sufficient for v1 |
| Payment escrow or holds | MercadoPago handles this; don't re-implement |
| Subscription billing (recurring charges) | One-time payment for plans is correct for v1 |
| Partial refunds | Out of scope; manual support handles edge cases |
| Real-time collaboration | Single-user/team mode only |
| Mobile app | Web-first; native apps are v3+ |
| Rate limiting on endpoints | Add when scaling beyond 1k users |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PAY-01 | 0 | Pending |
| PAY-02 | 0 | Pending |
| PAY-03 | 0 | Pending |
| PAY-04 | 0 | Pending |
| PAY-05 | 0 | Pending |
| PAY-06 | 0 | Pending |
| PAY-07 | 0 | Pending |
| PAY-08 | 0 | Pending |
| YT-01 | — | ✓ Completed |
| YT-02 | — | ✓ Completed |
| YT-03 | — | ✓ Completed |
| YT-04 | — | ✓ Completed |
| YT-05 | — | ✓ Completed |
| AUTH-01 | — | ✓ Completed |
| AUTH-02 | — | ✓ Completed |
| AUTH-03 | — | ✓ Completed |
| PLAN-01 | — | ✓ Completed |
| PLAN-02 | — | ✓ Completed |
| PLAN-03 | — | ✓ Completed |

**Coverage:**
- v1 (Phase 0) requirements: 8 total
- Mapped to phases: 8
- Unmapped: 0 ✓

---

*Requirements defined: 2026-04-27 after research*  
*Last updated: 2026-04-27 after Payment Reliability phase definition*
