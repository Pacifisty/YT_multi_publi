---
wave: 1
depends_on: []
files_modified:
  - .planning/DECISIONS.md
  - .env.production
autonomous: false
---

# PLAN 01: Infrastructure Decisions (Wave 1)

**Status:** Ready for execution  
**Effort:** 1-2 days (research + decision)  
**Risk:** Low — decisions only, no code changes yet

## Requirements Addressed

- **INFRA-01:** Production hosting (Railway or Fly.io)
- **INFRA-02:** Storage backend (R2 or B2)

## Objective

Research hosting providers, storage backends, and error tracking services. Document decision rationale and cost projections. Make final selections with clear reasoning.

## Must-Haves

1. ✓ Compare Railway vs Fly.io (features, cost, cold-start, regions)
2. ✓ Compare R2 vs B2 (cost, API, bandwidth, availability)
3. ✓ Compare Sentry vs DataDog (pricing, retention, features)
4. ✓ Document decision matrix with cost estimates
5. ✓ Provide cost projections at 100/1k/10k monthly active users

## Tasks

### Task 1: Research Hosting Providers

**Name:** Evaluate Railway vs Fly.io

**Read First:**
- `.planning/CONTEXT.md` (Phase 1 goals)
- `.env.example` (env vars that will be needed)

**Action:**
1. Create comparison table: Railway vs Fly.io
2. Columns: Feature, Railway, Fly.io, Winner
3. Features to compare:
   - Cost (free tier, per-app-instance, per-GB)
   - Cold start time (Node.js app)
   - Auto-scaling (horizontal, vertical)
   - Database support (managed PostgreSQL?)
   - Global regions (us-east, eu-west, ap-southeast, etc.)
   - GitHub integration (auto-deploy on push)
   - Monitoring/logs (built-in, or need Sentry?)
   - SSL/TLS (auto-renewal? Let's Encrypt?)
   - Health checks (webhook support for monitoring)
4. Cost projection at 100 MAU, 1k MAU, 10k MAU
5. Recommendation with reasoning

**Acceptance Criteria:**
```bash
grep -l "Railway\|Fly.io" .planning/DECISIONS.md
grep "Monthly cost" .planning/DECISIONS.md
grep -A 3 "Recommended:" .planning/DECISIONS.md
```

---

### Task 2: Research Storage Backends

**Name:** Evaluate R2 vs B2

**Read First:**
- `.planning/CONTEXT.md`

**Action:**
1. Create comparison: R2 vs B2 (Backblaze S3)
2. Columns: Metric, R2, B2, Notes
3. Metrics:
   - Cost per GB stored
   - Cost per GB downloaded (bandwidth)
   - API compatibility (S3-compatible?)
   - Public URL generation (for TikTok/Instagram)
   - Availability/redundancy
   - Speed (latency for video delivery)
   - Support for video streaming (HTTP range requests)
4. Cost calculation: 50GB storage + 200GB monthly bandwidth (video downloads)
5. Recommendation: R2 (S3-compatible, good for public videos) or B2 (cheaper storage)?

**Acceptance Criteria:**
```bash
grep "R2\|B2" .planning/DECISIONS.md
grep "bandwidth\|Download" .planning/DECISIONS.md
grep "Total monthly" .planning/DECISIONS.md
```

---

### Task 3: Error Tracking Selection

**Name:** Choose Sentry vs DataDog

**Read First:**
- `.planning/CONTEXT.md`
- `.planning/REQUIREMENTS.md` (Phase 0 work: payment error classification, logging)

**Action:**
1. Compare Sentry vs DataDog
2. Metrics:
   - Free tier: events/month, retention days
   - Cost: $0-50/month tier
   - Features: error grouping, source maps, breadcrumbs, session replay
   - Integrations: Slack, GitHub, custom webhooks
   - Setup effort (SDK, environment config)
   - Overkill? Start with Sentry (simpler) vs DataDog (enterprise)
3. Recommendation: Sentry (free tier ~5k events/month, perfect for MVP)
4. Config strategy: Sentry DSN in env vars, report errors from payment system

**Acceptance Criteria:**
```bash
grep "Sentry\|DataDog" .planning/DECISIONS.md
grep "Free tier" .planning/DECISIONS.md
grep "Recommended" .planning/DECISIONS.md
```

---

### Task 4: Database Migration Strategy

**Name:** Define PostgreSQL migration approach

**Read First:**
- `prisma/schema.prisma` (existing schema)
- `.env.example` (DATABASE_URL format)

**Action:**
1. Define migration path:
   - Option A: Use Railway's managed PostgreSQL (simplest, included)
   - Option B: Use Fly.io's PostgreSQL (regional, slower for US)
   - Option C: Use Supabase (managed Postgres + Auth, but adds complexity)
2. Document: Connection string format, SSL requirement, credentials rotation
3. Data migration: If prod has data, create backup/restore strategy
4. Schema deployment: Prisma db push or manual migrations?
5. Checklist: Extensions needed (uuid-ossp, JSON, etc.)

**Acceptance Criteria:**
```bash
grep "PostgreSQL" .planning/DECISIONS.md
grep "Connection string\|DATABASE_URL" .planning/DECISIONS.md
grep "Migration strategy" .planning/DECISIONS.md
```

---

### Task 5: Final Decision Document

**Name:** Commit decisions to .planning/DECISIONS.md

**Read First:**
- Tasks 1-4 outputs

**Action:**
1. Create `.planning/DECISIONS.md` with:
   - **Hosting:** Railway [Recommendation: yes, simple auto-deploy, fast cold-start]
   - **Storage:** R2 [Reason: S3-compatible, public URLs for TikTok/Instagram, ~$5/month]
   - **Error Tracking:** Sentry [Reason: free tier sufficient for MVP, easy integration]
   - **Database:** Railway PostgreSQL [Reason: included with hosting, no separate account]
   - **Cost Estimate:** $50-150/month at 1k MAU (hosting $30-50, storage $5, Sentry $0-20, DB $10-30)
2. Rationale section: Why these choices?
3. Next phase: Setup & Deploy

**Acceptance Criteria:**
```bash
test -f .planning/DECISIONS.md
grep "Hosting:" .planning/DECISIONS.md
grep "Storage:" .planning/DECISIONS.md
grep "Cost Estimate" .planning/DECISIONS.md
```

---

## Verification Checklist

1. Hosting comparison complete (Railway vs Fly.io)
2. Storage comparison complete (R2 vs B2)
3. Error tracking decision made (Sentry vs DataDog)
4. Database migration strategy defined
5. Cost estimates documented
6. Recommendation clear and justified

## Success Criteria

- ✓ `.planning/DECISIONS.md` created with all 4 decisions
- ✓ Cost projections at 100/1k/10k MAU
- ✓ Rationale documented (why these choices)
- ✓ Next phase (Setup & Deploy) has clear action items
