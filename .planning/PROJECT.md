# YT Multi-Publisher

## What This Is

A multi-channel video publishing platform that lets creators publish content to YouTube, TikTok, and Instagram simultaneously from one interface. Users manage campaigns with scheduling, asset organization, and per-channel targeting. Currently shipping YouTube + payments; TikTok/Instagram scaffolding in place.

## Core Value

Users can publish to multiple platforms at once instead of uploading separately to each — eliminating repetitive manual work that scales badly with each new channel.

## Requirements

### Validated

✓ **YouTube Integration** — Users can upload videos to YouTube channels with metadata  
✓ **Multi-Account Support** — OAuth connection for multiple YouTube accounts per user  
✓ **Media Management** — Upload, organize, and store video + thumbnail assets  
✓ **Campaign Scheduling** — Create campaigns with publish date/time targeting per channel  
✓ **Subscription Plans** — BASIC/PRO/PREMIUM tiers with token limits (existing)  
✓ **Payment Processing** — MercadoPago Checkout Pro integration for plan purchases  
✓ **Admin Authentication** — Email/password + Google OAuth for user accounts  

### Active

- [ ] **Payment Reliability** — Webhook idempotency, structured logging, startup validation, end-to-end tests
- [ ] **TikTok Publishing** — Resumable upload, account connection, public media URLs, campaign targeting
- [ ] **Instagram Publishing** — Upload to Instagram Reels, account connection, campaign targeting
- [ ] **Production Infrastructure** — Hosting (Railway/Fly.io), storage backend (R2/B2), monitoring

### Out of Scope

- **Email Notifications** — Deferred to v2 (not MVP)
- **Analytics Dashboard** — Deferred to v2 (usage metrics can come later)
- **Advanced Retry Policies** — Current transient/permanent classification sufficient for v1
- **Rate Limiting** — Add when scaling beyond 1k users
- **Real-time Collaboration** — Single-user/team mode only for now
- **Mobile App** — Web-first; native apps are v3+

## Context

### Technical Environment
- **Stack:** Node.js + TypeScript, Prisma ORM, PostgreSQL, Vanilla JS frontend
- **Payments:** MercadoPago (integrated 2026-04-27, CNPJ acquired, account live)
- **Social APIs:** googleapis (YouTube v3), TikTok SDK (scaffolding), Instagram SDK (scaffolding)
- **Storage:** Local filesystem for dev; needs S3-compatible (R2/B2) for production
- **Testing:** Vitest (70% coverage target); some tests failing (campaign-controller.test.ts)

### Known Technical Debt
From codebase audit (2026-04-27):
- **Payment workflow** untested end-to-end; webhook processing has no idempotency check
- **Zero structured logging** — console.log only; production debugging impossible
- **Job processing synchronous** — blocks on uploads; needs async queue (Bull/BullMQ)
- **15/24 media assets dangling** from prior git cleanup; orphan cleanup policy undefined
- **Error classification** implemented but not integrated into retry logic
- **TikTok/Instagram** scaffolding incomplete

### Prior Product Decisions
- **Multi-channel approach** validated by user pain (manual cross-posting is exhausting)
- **YouTube first, others later** — YouTube accepts byte upload; TikTok/Instagram require public URL + review
- **PaymentService provider pattern** — PaymentProviderAdapter interface allows swapping providers without changing contracts
- **Public media URL signing** — Already built for TikTok/Instagram future; TTL configurable

## Constraints

- **Timeline:** No hard deadline; user-driven prioritization
- **Budget:** CNPJ acquired, Mercado Pago production live; hosting/storage TBD
- **Tech Stack:** Locked on Node.js + Prisma (both working well; no plans to change)
- **Platform Support:** YouTube required; TikTok/Instagram come after payment reliability + infra decisions
- **Production Safety:** No public launch until Payment Reliability phase complete + monitoring in place

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Multi-channel product (not single-channel) | Solves real creator pain; differentiated vs. generic YouTube schedulers | ✓ Correct — drives core value |
| YouTube-first, TikTok later | YT has direct upload; TikTok needs public URL + review process | ✓ Correct — accelerated initial launch |
| PaymentService adapter pattern | Allows MercadoPago integration without leaking types to codebase | ✓ Correct — integration was clean, easy to test |
| Payment Reliability before TikTok | Payment is live now; one bug (double-charge) = reputation damage + escalation | ✓ Correct — foundational before expansion |
| Structured logging before production | Current console.log makes debugging failures impossible | — Pending execution |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone:**
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

*Last updated: 2026-04-27 after brownfield initialization with codebase mapping*
