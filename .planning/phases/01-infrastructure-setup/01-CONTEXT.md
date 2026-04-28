# Phase 1: Infrastructure Setup - Context

**Gathered:** 2026-04-28  
**Status:** Ready for planning  
**Source:** Roadmap + Phase 0 completion

## Phase Boundary

Phase 1 gates Phases 2-4 (TikTok, Instagram, QoL). Before public launch:
- Choose production hosting (Railway or Fly.io) + cost estimate
- Choose storage backend (R2 or B2) + cost estimate  
- Define database migration (local PostgreSQL → managed)
- Configure error tracking (Sentry or DataDog)
- Deploy staging + smoke test

## Implementation Decisions

### Hosting Provider Selection
- **Evaluate:** Railway (simpler, auto-scaling) vs Fly.io (more control, global regions)
- **Decision criteria:** Cost at 100 MAU, cold start time, auto-deploy, multi-region support
- **Target:** Production HTTPS URL with TLS certificate
- **Cost estimate required:** Monthly cost projection at 100/1k/10k users

### Storage Backend Selection
- **Evaluate:** Cloudflare R2 (S3-compatible, cheaper) vs Backblaze B2 (budget-friendly, API works)
- **Decision criteria:** Cost per GB, API compatibility with existing code, bandwidth pricing
- **Target:** Public media URLs for TikTok/Instagram videos (videos must be downloadable by platform)
- **Cost estimate required:** Monthly storage + bandwidth at 50GB/month

### Database Migration Strategy
- **Current:** SQLite or in-memory during dev, Prisma schema exists
- **Target:** Managed PostgreSQL (Railway, Fly, or Supabase)
- **Decision:** Use hosting provider's managed DB OR separate database service?
- **Deliverable:** Migration script (if data exists), connection string config

### Error Tracking Integration
- **Evaluate:** Sentry (JS + backend, generous free tier) vs DataDog (enterprise, expensive)
- **Target:** Capture payment errors, webhook failures, API timeouts
- **Decision:** Self-hosted vs SaaS? Data retention policy?

### Deployment Automation
- **Current:** Manual deployment (possibly)
- **Target:** CI/CD pipeline (GitHub Actions → railway/fly.io)
- **Deliverable:** GitHub Actions workflow file with health check

## Claude's Discretion

- Specific hosting region (us-east? eu-west? multi-region?)
- TLS certificate strategy (auto-renewal, Let's Encrypt vs managed)
- Environment variable management (secrets, .env handling in production)
- Rollback strategy (if deployment fails)
- Monitoring dashboard (what metrics to watch?)

## Canonical References

- `.planning/ROADMAP.md` — Phase 1 goals and success criteria
- `.planning/REQUIREMENTS.md` — INFRA-01, INFRA-02
- `apps/api/src/app.ts` — App initialization, environment config
- `.env.example` — All production env vars needed

## Specific Ideas

- Use Railway's GitHub integration for automatic deployments
- Use R2 for public media URLs (works out-of-box with TikTok)
- PostgreSQL 14+ for JSONB, uuid-ossp extensions
- Sentry for error tracking (free tier covers 5k events/month)

## Deferred Ideas

- Multi-region disaster recovery (Phase v1.1)
- CDN for video delivery (Phase v1.1)
- Custom domain with Route53 (handled after launch)
- Advanced monitoring/dashboards (Phase v1.1)
