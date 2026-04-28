# Roadmap: YT Multi-Publisher

**Created:** 2026-04-27  
**Core Value:** Users can publish to multiple platforms at once

## Phase Structure

| # | Phase | Goal | Requirements | Status |
|---|-------|------|--------------|--------|
| 0 | Payment Reliability | Harden payment system for production | PAY-01 through PAY-08 | Pending |
| 1 | Infrastructure Setup | Define and configure hosting + storage | INFRA-01, INFRA-02 | Pending |
| 2 | TikTok Integration | Implement TikTok publishing | TIK-01 through TIK-04 | Pending |
| 3 | Instagram Integration | Implement Instagram publishing | IG-01 through IG-03 | Pending |
| 4 | Quality of Life | UX improvements + analytics | UX-01 through UX-03 | Pending |

---

## Phase 0: Payment Reliability

**Goal:** Payment system is debuggable, safe, and production-ready before public launch.

**Requirements:**
- PAY-01: Webhook idempotency
- PAY-02: Structured logging
- PAY-03: Startup validation
- PAY-04: Webhook signature verification (verify existing)
- PAY-05: Transactional consistency
- PAY-06: End-to-end payment tests
- PAY-07: API timeout handling
- PAY-08: Error classification integration (optional)

**Success Criteria:**
1. ✓ Payment flow is fully logged and searchable by intentId/email
2. ✓ Same webhook cannot be processed twice (idempotency verified via test)
3. ✓ App fails at startup if MERCADOPAGO_ACCESS_TOKEN missing (vs. silently using mock)
4. ✓ All payment state transitions (checkout → webhook → tokens credited) tested end-to-end
5. ✓ Webhook processing has timeout and graceful failure handling
6. ✓ Error logs help diagnose any payment failure within 5 minutes

**Constraints:**
- Must complete before public launch
- Must complete before TikTok integration (TikTok needs stable payment foundation)
- No breaking changes to existing checkout flow

**Estimated Effort:**
- Setup logging infrastructure: 1 day
- Implement idempotency: 1 day
- Startup validation: 0.5 day
- End-to-end tests (mock MercadoPago): 2 days
- Error classification integration (optional): 1 day
- **Total: ~5-6 days**

---

## Phase 1: Infrastructure Setup

**Goal:** Define production hosting and storage; configure monitoring.

**Requirements:**
- INFRA-01: Production hosting (Railway or Fly.io)
- INFRA-02: Storage backend (R2 or B2)

**Success Criteria:**
1. ✓ Decide hosting provider + cost estimate
2. ✓ Decide storage provider + cost estimate
3. ✓ Database migration strategy defined (local → managed Postgres)
4. ✓ Error tracking (Sentry or DataDog) configured
5. ✓ Deploy production environment with real data

**Constraints:**
- Wait for Phase 0 to complete (need stable payment system before prod)
- Configure monitoring before going public

**Dependencies:**
- Phase 0 must be complete

**Estimated Effort:**
- Research + decision: 1 day
- Setup hosting: 1 day
- Configure storage: 1 day
- Migrate database: 1 day
- Deploy + smoke test: 1 day
- **Total: ~5 days**

---

## Phase 2: TikTok Integration

**Goal:** Add TikTok as a publishing target alongside YouTube.

**Requirements:**
- TIK-01: TikTok resumable upload
- TIK-02: Account connection (OAuth)
- TIK-03: Public media URL generation
- TIK-04: Campaign targeting for TikTok

**Success Criteria:**
1. ✓ User can connect TikTok account via OAuth
2. ✓ User can create campaign targeting TikTok channels
3. ✓ Video uploads to TikTok (at least one test upload succeeds)
4. ✓ Campaign shows status (pending, published, failed) per TikTok channel
5. ✓ Public media URLs work (TikTok can download video)

**Constraints:**
- TikTok requires HTTPS public URL (configure in Phase 1 first)
- TikTok review process may reject videos (account may be flagged)
- Must use public media URLs (local storage doesn't work)

**Dependencies:**
- Phase 0: Payment system stable
- Phase 1: Public HTTPS URL + S3-compatible storage

**Estimated Effort:**
- TikTok SDK integration: 2 days
- Account connection + OAuth: 1 day
- Campaign UI updates: 1 day
- Testing + debugging: 2 days
- **Total: ~6-7 days**

---

## Phase 3: Instagram Integration

**Goal:** Add Instagram as a publishing target.

**Requirements:**
- IG-01: Instagram Reels upload
- IG-02: Account connection (OAuth)
- IG-03: Campaign targeting for Instagram

**Success Criteria:**
1. ✓ User can connect Instagram account via OAuth
2. ✓ User can create campaign targeting Instagram accounts
3. ✓ Video uploads to Instagram Reels (at least one test succeeds)
4. ✓ Campaign shows status per Instagram account

**Constraints:**
- Instagram's approval process for business accounts can be slow
- Reels have specific format requirements (square, short duration)

**Dependencies:**
- Phase 0: Payment system stable
- Phase 1: Public HTTPS URL + storage
- Phase 2: TikTok done (learn from integration, reuse patterns)

**Estimated Effort:**
- Similar to TikTok (~6-7 days)
- Patterns from TikTok reduce work by ~1 day

---

## Phase 4: Quality of Life

**Goal:** Improve user experience with notifications, analytics, and error visibility.

**Requirements:**
- UX-01: Email notifications
- UX-02: Analytics dashboard
- UX-03: Failed job dashboard

**Success Criteria:**
1. ✓ User receives email when payment completes
2. ✓ User sees analytics: videos published, success rate per channel
3. ✓ Operator can view failed jobs + error details

**Constraints:**
- Email provider needed (SendGrid, Mailgun)
- Analytics SQL queries performant

**Dependencies:**
- Phase 0: Logging in place (needed for analytics)
- Phase 2-3: Multiple platforms shipping

**Estimated Effort:**
- Email setup + templates: 2 days
- Analytics schema + queries: 2 days
- Dashboard UI: 2 days
- **Total: ~6 days**

---

## Overall Timeline

```
Phase 0 (Payment Reliability):        5-6 days
Phase 1 (Infrastructure):             5 days     [after Phase 0]
Phases 2-4 (parallel possible):       6-7 days each
                                      --------
Total (sequential):                   21-26 days
Total (2-4 parallel after 1):         16-18 days
```

## Milestone: v1 Public Launch

**Trigger:** Phase 0 + Phase 1 complete + Phase 2 (TikTok) complete

**Launch checklist:**
- ✓ Payment system tested, logged, monitored
- ✓ Infrastructure production-ready (hosting + storage + monitoring)
- ✓ YouTube + TikTok publishing working
- ✓ User documentation complete
- ✓ Support plan in place

**After launch:** Phase 3 (Instagram) + Phase 4 (QoL) as post-launch updates

---

## Notes

- **Phases 2-4 can run in parallel** (after Phase 1 infra is ready), reducing total time to ~18 days from design start
- **Phase 0 is critical path** — nothing ships until payment is reliable
- **Phase 1 (infra) gates Phases 2-4** — all public platforms need HTTPS + storage
- **Success criteria are user-observable** (user can do X), not implementation details

---

*Roadmap created: 2026-04-27 after requirements definition*  
*Last updated: 2026-04-27*
