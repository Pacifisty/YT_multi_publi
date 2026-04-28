---
wave: 2
depends_on:
  - 01-01-decisions-PLAN
files_modified:
  - .github/workflows/deploy.yml
  - .env.production
  - apps/api/src/app.ts
  - prisma/migrations/xxxx_prod_init.sql
autonomous: false
---

# PLAN 02: Setup & Deploy (Wave 2)

**Status:** Ready for execution (after decisions finalized)  
**Effort:** 2-3 days (config + testing + first deploy)  
**Risk:** Medium — production deployment, requires care

## Requirements Addressed

- **INFRA-01:** Production hosting configured (Railway)
- **INFRA-02:** Storage backend configured (R2)

## Objective

Create production accounts (Railway, R2, Sentry). Set up environment configuration. Create deployment pipeline (GitHub Actions → Railway). Perform database migration. Deploy to staging + run smoke tests.

## Must-Haves

1. ✓ Railway account created + app set up with GitHub auto-deploy
2. ✓ R2 bucket created + public URL access configured
3. ✓ Sentry project created + DSN in env vars
4. ✓ PostgreSQL database provisioned (via Railway)
5. ✓ GitHub Actions workflow created (CI/CD pipeline)
6. ✓ Staging deployment successful + smoke tests pass
7. ✓ Production secrets (.env) secured (no secrets in repo)

## Tasks

### Task 1: Set Up Railway Account & App

**Name:** Create Railway app with GitHub integration

**Read First:**
- `.planning/DECISIONS.md` (hosting choice: Railway)

**Action:**
1. Create Railway account (railway.app)
2. Connect GitHub repo via OAuth
3. Create new project: "YT Multi-Publisher"
4. Create service: Node.js app
   - Build: `npm install && npm run build`
   - Start: `npm run start`
   - PORT: 3000 (default)
5. Set environment variables in Railway dashboard:
   - NODE_ENV=production
   - DATABASE_URL (auto-generated)
   - MERCADOPAGO_ACCESS_TOKEN (from Phase 0)
   - MERCADOPAGO_WEBHOOK_SECRET
   - PAYMENT_SUCCESS_URL (production domain)
   - PAYMENT_CANCEL_URL (production domain)
   - PAYMENT_WEBHOOK_URL (production domain)
   - SENTRY_DSN (from Task 3)
6. Enable GitHub auto-deploy: Deploy on every push to main
7. Test: Push dummy commit, verify auto-deploy works
8. Document production domain URL

**Acceptance Criteria:**
```bash
# Check that Railway domain is accessible
curl -s https://{railway-domain}.railway.app/api/health | grep -q "ok"
grep "RAILWAY_DOMAIN=" .planning/DECISIONS.md
```

---

### Task 2: Configure S3 / R2 Storage

**Name:** Create R2 bucket + public access

**Read First:**
- `.planning/DECISIONS.md` (storage choice: R2)

**Action:**
1. Create Cloudflare account (if not exists)
2. Create R2 bucket: "yt-multi-publi-media"
3. Configure public access:
   - Set CORS policy to allow GET from *.tiktok.com, *.instagram.com
   - Create custom domain: media.{domain}.com (or use R2 default)
4. Generate API tokens: Access key + secret
5. Add to environment variables:
   - R2_ACCOUNT_ID
   - R2_ACCESS_KEY_ID
   - R2_ACCESS_KEY_SECRET
   - R2_BUCKET_NAME
   - R2_PUBLIC_URL (https://media.example.com)
6. Update code: Load R2 credentials from env in media service
7. Test upload: PUT a test video, verify public URL is accessible

**Acceptance Criteria:**
```bash
# Public URL should return video without auth
curl -s https://media.example.com/test-video.mp4 | head -c 4 | grep -q "ftyp"
grep "R2_PUBLIC_URL" .env.production
```

---

### Task 3: Create Sentry Project

**Name:** Set up error tracking via Sentry

**Read First:**
- `.planning/DECISIONS.md` (error tracking: Sentry)

**Action:**
1. Create Sentry account (sentry.io)
2. Create new org: "YT Multi-Publisher"
3. Create project: Node.js
4. Copy Sentry DSN (looks like: https://key@sentry.io/project)
5. Add to environment variables: SENTRY_DSN
6. Integrate in app.ts:
   ```typescript
   import * as Sentry from "@sentry/node";
   Sentry.init({ dsn: env.SENTRY_DSN, environment: "production" });
   ```
7. Test: Trigger a dummy error, verify Sentry receives it
8. Configure alerts: Notify Slack on new errors (if Slack team exists)

**Acceptance Criteria:**
```bash
grep "SENTRY_DSN" apps/api/src/app.ts
grep "@sentry/node" package.json
# Test error appears in Sentry dashboard
```

---

### Task 4: Database Migration & Seeding

**Name:** Migrate to managed PostgreSQL

**Read First:**
- `prisma/schema.prisma` (current schema)
- `.env.production` (DATABASE_URL from Railway)

**Action:**
1. Railway creates PostgreSQL automatically, provides DATABASE_URL
2. Connect locally to staging DB: Set DATABASE_URL in .env.local
3. Run Prisma migrate: `npx prisma migrate deploy`
   - Creates all tables (users, payments, campaigns, etc.)
   - Runs any pending migrations
4. Seed data (optional for staging):
   - Create test admin user
   - Create test payment intents
5. Backup strategy documented:
   - Railway provides automated daily backups
   - Manual backup before major schema changes
6. Test connection: `npx prisma db execute --stdin < "SELECT NOW()"`

**Acceptance Criteria:**
```bash
npx prisma db execute --stdin < "SELECT table_name FROM information_schema.tables" | grep -q "admin_users"
# Connection string is set
grep "DATABASE_URL" .env.production
```

---

### Task 5: Create CI/CD Pipeline (GitHub Actions)

**Name:** Set up GitHub Actions for auto-deploy

**Read First:**
- `.planning/DECISIONS.md` (Railway chosen for auto-deploy)
- `package.json` (build + test scripts)

**Action:**
1. Create `.github/workflows/deploy.yml`:
   - Trigger: on push to main
   - Steps:
     - Checkout code
     - Node.js 18 setup
     - npm ci (clean install)
     - npm run lint (if exists)
     - npm run test (run test suite)
     - If tests pass: Railway auto-deploys (via GitHub integration)
2. Add health check: After deploy, ping /api/health for 5 min
3. Add Slack notification (if Slack bot exists)
4. Test: Push to main, verify workflow runs and deployment succeeds

**Acceptance Criteria:**
```bash
test -f .github/workflows/deploy.yml
grep "npm test\|npm run test" .github/workflows/deploy.yml
grep "health\|health-check" .github/workflows/deploy.yml
```

---

### Task 6: Staging Deployment & Smoke Tests

**Name:** Deploy to staging + verify basics work

**Read First:**
- All tasks above (config complete)

**Action:**
1. Set NODE_ENV=staging in Railway
2. Deploy to staging: Push to staging branch (or use Railway's preview deploys)
3. Run smoke tests:
   - Health check: GET /api/health → 200
   - Auth check: POST /api/auth/login with test user → 200 + token
   - Payment check: POST /api/account-plan/create-checkout → 201 + checkoutUrl
   - Webhook check: POST /api/account-plan/webhook with mock payment → 200
4. Check logs in Railway dashboard for errors
5. Verify Sentry is receiving errors (trigger dummy error)
6. Document staging URL in DECISIONS.md

**Acceptance Criteria:**
```bash
curl -s https://staging.{domain}/api/health | grep -q "ok"
grep "STAGING_URL=" .planning/DECISIONS.md
grep "Smoke tests passed" .planning/DECISIONS.md
```

---

### Task 7: Production Deployment Readiness

**Name:** Verify production is ready (don't deploy yet)

**Read First:**
- All tasks above

**Action:**
1. Create pre-launch checklist:
   - Database backups automated ✓
   - Sentry alerts configured ✓
   - TLS certificate auto-renewal enabled ✓
   - Rate limiting configured (or defer to Phase 2)
   - Logging/monitoring set up ✓
2. Document rollback procedure:
   - If production breaks: Rollback to previous Railway deployment
   - If database breaks: Restore from Railway backup
3. Create runbook: "How to deploy to production"
4. **DO NOT deploy to production yet** — wait for Phase verification
5. Document all secrets (in 1Password or similar, not in repo)

**Acceptance Criteria:**
```bash
grep "Production Ready" .planning/DECISIONS.md
test -f docs/DEPLOYMENT.md
# Secrets are NOT in git
! grep -r "sk_live\|MERCADOPAGO" .git
```

---

## Verification Checklist

1. Railway app created + auto-deploy working
2. R2 bucket created + public URLs work
3. Sentry DSN configured + test error received
4. PostgreSQL running with all schema tables
5. GitHub Actions workflow created and passing
6. Staging deployment successful
7. Smoke tests passing
8. Production secrets secured (not in repo)
9. Rollback procedure documented

## Success Criteria

- ✓ Staging environment fully functional
- ✓ All smoke tests pass (health, auth, payment, webhook)
- ✓ Sentry receiving errors
- ✓ Database backups automated
- ✓ CI/CD pipeline working (tests → deploy)
- ✓ Production environment ready but NOT yet deployed
