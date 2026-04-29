# Roadmap: YT Multi-Publisher

**Created:** 2026-04-27  
**Core Value:** Users can publish to multiple platforms at once

## Phase Structure

| # | Phase | Goal | Requirements | Status |
|---|-------|------|--------------|--------|
| 0 | Payment Reliability | Harden payment system for production | PAY-01 through PAY-08 | ✓ Complete |
| 1 | Infrastructure Setup | Define and configure hosting + storage | INFRA-01, INFRA-02 | ✓ Complete |
| 2 | TikTok Integration | Implement TikTok publishing | TIK-01 through TIK-04 | ✓ Complete |
| 3 | Instagram Integration | Implement Instagram publishing | IG-01 through IG-03 | ✓ Complete |
| 4 | Quality of Life | UX improvements + analytics | UX-01 through UX-03 | In Progress |
| 5 | Launch Readiness | Go-live gates, verification, rollback playbooks | LR-01 through LR-03 | In Progress |

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
- IG-02: Instagram account connection (OAuth)
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

**Plans:**
- [x] 04-01-PLAN.md — Failed Job Dashboard (complete: operations queue with retry/reauth/review actions)
- [x] 04-02-PLAN.md — Analytics Dashboard (platform and destination-level metrics)
- [x] 04-03-PLAN.md — Email Notifications (payment confirmation and campaign outcome emails)

**Success Criteria:**
1. ✓ User receives email when payment completes
2. ✓ User sees analytics: videos published, success rate per channel
3. ✓ Operator can view failed jobs + error details

**Constraints:**
- Email provider needed (SendGrid, Mailgun, Resend)
- Analytics queries performant
- Email sends must not block campaign processing

**Dependencies:**
- Phase 0: Logging in place (needed for analytics)
- Phase 1: Infrastructure ready (email provider credentials)
- Phase 2-3: Multiple platforms shipping (for platform analytics)

**Estimated Effort:**
- Email service abstraction + templates: 1 day
- Integration into payment and campaign services: 1 day
- Analytics dashboard data extension: 1 day
- Tests for email and analytics: 1 day
- **Total: ~4 days**

---
## Phase 5: Launch Readiness

**Goal:** Launch v1 with explicit release gates and a repeatable verification + rollback process.

**Requirements:**
- LR-01: Go-live verification suite
- LR-02: Release gating checklist and ownership
- LR-03: Rollback and incident playbooks

**Plans:**
- [ ] 05-01-PLAN.md - Go-Live Verification Suite
- [ ] 05-02-PLAN.md - Release Gate and Ownership Matrix
- [ ] 05-03-PLAN.md - Rollback and Incident Playbooks

**Success Criteria:**
1. Launch decision is based on recorded evidence, not ad-hoc checks
2. Every launch gate has owner and fallback owner
3. Rollback can be executed in under 30 minutes with a written playbook

**Constraints:**
- Must not block ongoing Phase 4 implementation
- Must reuse existing tests/scripts before adding new automation
- Production credentials and providers remain user-controlled

**Dependencies:**
- Phase 0-3 complete
- Phase 4 can continue in parallel

**Estimated Effort:**
- Verification suite and runbook: 1 day
- Release gates and ownership matrix: 1 day
- Rollback and incident playbooks: 1 day
- **Total: ~3 days**

---
## Overall Timeline

```
Phase 0 (Payment Reliability):        5-6 days        [✓ COMPLETE]
Phase 1 (Infrastructure):             5 days          [✓ COMPLETE]
Phase 2 (TikTok):                     6-7 days        [✓ COMPLETE]
Phase 3 (Instagram):                  5-6 days        [✓ COMPLETE]
Phase 4 (Quality of Life):            4 days          [IN PROGRESS]
Phase 5 (Launch Readiness):           3 days          [IN PROGRESS]
                                      --------
Total (planned):                      28-31 days
Total (achieved by 2026-04-28):       83% complete
```

## Milestone: v1 Public Launch

**Trigger:** Phase 0 + Phase 1 complete + Phase 2 (TikTok) complete

**Launch checklist:**
- ✓ Payment system tested, logged, monitored
- ✓ Infrastructure production-ready (hosting + storage + monitoring)
- ✓ YouTube + TikTok publishing working
- ✓ Instagram publishing working
- ✓ Failed job visibility available to operators
- ⧵ Email notifications on payment and campaign outcomes (Phase 4)
- ⧵ Analytics dashboard (Phase 4)

**After launch:** Phase 4 remaining tasks (email notifications, analytics) as immediate post-launch updates

---

## Notes

- **Phase 0 is critical path** — nothing ships until payment is reliable
- **Phase 1 (infra) gates Phases 2-4** — all public platforms need HTTPS + storage
- **Phases 2-3 run parallel** (after Phase 1), TikTok doesn't block Instagram
- **Phase 4 and Phase 5 run in parallel** (feature completion + release readiness)
- **Success criteria are user-observable** (user can do X), not implementation details

---

*Roadmap created: 2026-04-27 after requirements definition*  
*Last updated: 2026-04-28 after Phase 5 kickoff planning*
