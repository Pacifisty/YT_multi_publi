# Pre-Launch Deployment Checklist

**Created:** 2026-04-28  
**Status:** Ready for Phase 1 Verification  
**Target Launch:** After all items are complete

---

## Infrastructure & Accounts

### Cloud Services Setup

- [ ] **Railway Account Created**
  - Sign up at https://railway.app
  - Repository linked (GitHub integration)
  - Service created for Node.js app

- [ ] **Cloudflare Account with R2**
  - Cloudflare account created
  - R2 bucket created: `yt-multi-publi-prod-media`
  - Bucket is public (Block public access: OFF)
  - CORS rules configured for TikTok/Instagram

- [ ] **Sentry Project Created**
  - Sentry account created at https://sentry.io
  - Project created (Platform: Node.js)
  - DSN copied and saved

- [ ] **Mercado Pago Account**
  - Sandbox account created (for testing)
  - Production account ready (for live payments)
  - API credentials generated

---

## Environment Configuration

### Production Environment Variables

- [ ] **`.env.production` variables configured in Railway**
  - [ ] NODE_ENV=production
  - [ ] DATABASE_URL (auto-populated by Railway)
  - [ ] PUBLIC_APP_URL (Railway domain)
  - [ ] SENTRY_DSN (from Sentry project)

- [ ] **Google OAuth Credentials**
  - [ ] GOOGLE_CLIENT_ID
  - [ ] GOOGLE_CLIENT_SECRET
  - [ ] GOOGLE_REDIRECT_URI updated in Google Console
  - [ ] GOOGLE_AUTH_REDIRECT_URI updated in Google Console

- [ ] **TikTok OAuth Credentials (Phase 2)**
  - [ ] TIKTOK_CLIENT_KEY
  - [ ] TIKTOK_CLIENT_SECRET
  - [ ] TIKTOK_REDIRECT_URI updated in TikTok Console

- [ ] **Cloudflare R2 Credentials**
  - [ ] R2_ACCOUNT_ID
  - [ ] R2_ACCESS_KEY_ID
  - [ ] R2_ACCESS_KEY_SECRET
  - [ ] R2_BUCKET_NAME
  - [ ] R2_PUBLIC_URL

- [ ] **Mercado Pago Credentials**
  - [ ] MERCADOPAGO_ACCESS_TOKEN (TEST- for sandbox, APP_USR- for production)
  - [ ] MERCADOPAGO_WEBHOOK_SECRET

- [ ] **Payment Flow URLs**
  - [ ] PAYMENT_SUCCESS_URL
  - [ ] PAYMENT_CANCEL_URL
  - [ ] PAYMENT_WEBHOOK_URL

- [ ] **Authentication**
  - [ ] OAUTH_TOKEN_KEY (32 random bytes)
  - [ ] ADMIN_EMAIL
  - [ ] ADMIN_PASSWORD_HASH

### Staging Environment (Optional)

- [ ] **`.env.staging` configured (if using staging deployment)**
  - [ ] All variables set with staging credentials
  - [ ] R2 bucket for staging: `yt-multi-publi-staging-media`
  - [ ] Separate Sentry project for staging errors
  - [ ] Mercado Pago TEST credentials (sandbox)

---

## Database Setup

- [ ] **PostgreSQL Provisioned**
  - [ ] Railway PostgreSQL service created
  - [ ] DATABASE_URL injected by Railway
  - [ ] Connection verified (app logs show successful connection)

- [ ] **Database Schema Deployed**
  - [ ] Prisma migrations run: `prisma db push` or `prisma migrate deploy`
  - [ ] All tables created (verify in Railway PostgreSQL logs)
  - [ ] Indexes created for performance
  - [ ] No schema errors in application logs

- [ ] **Database Backup Configured**
  - [ ] Railway auto-backup enabled (daily, automatic)
  - [ ] Backup retention policy confirmed (30+ days)
  - [ ] Restore procedure tested (if possible)

---

## GitHub Actions & CI/CD

- [ ] **GitHub Actions Workflow Created**
  - [ ] File exists: `.github/workflows/deploy.yml`
  - [ ] Workflow syntax is valid (no YAML errors)
  - [ ] Triggers on push to `main` branch

- [ ] **GitHub Actions Tested**
  - [ ] Workflow runs successfully on code push
  - [ ] Linter passes (or configured to continue on lint errors)
  - [ ] Tests pass (or configured to continue on test failures)
  - [ ] Railway deployment completes (GitHub integration active)
  - [ ] Health check passes after deployment

- [ ] **GitHub Secrets Configured (Optional)**
  - [ ] RAILWAY_TOKEN (if using Railway CLI for manual deploys)
  - [ ] RAILWAY_DOMAIN (for health check endpoint)
  - [ ] SLACK_WEBHOOK_URL (for notifications, optional)

---

## Code Integration & Testing

- [ ] **Sentry Integration Complete**
  - [ ] `@sentry/node` imported in `apps/api/src/app.ts`
  - [ ] Sentry.init() called in createApp() function
  - [ ] Only initializes if NODE_ENV=production AND SENTRY_DSN is set
  - [ ] Error handler middleware captures exceptions with context

- [ ] **Payment Validation**
  - [ ] `validatePaymentConfig()` runs at startup
  - [ ] MERCADOPAGO_ACCESS_TOKEN is required in production
  - [ ] Startup aborts with exit code 1 if critical vars missing

- [ ] **Database Connection**
  - [ ] App initializes Prisma client if DATABASE_URL is set
  - [ ] Database connectivity verified in logs

- [ ] **Tests Passing**
  - [ ] Unit tests: `npm test`
  - [ ] Linting: `npm run lint`
  - [ ] No TypeScript errors: `npm run build` (if applicable)
  - [ ] Smoke tests pass (manual or automated)

---

## OAuth & Authentication

- [ ] **Google OAuth Setup**
  - [ ] OAuth app created in Google Cloud Console
  - [ ] Client ID and Secret copied to Railway Variables
  - [ ] Authorized redirect URIs include Railway domain:
    - `https://{railway-domain}/workspace/accounts/callback`
    - `https://{railway-domain}/login/callback`
  - [ ] Login flow tested (tested with real Google account)

- [ ] **TikTok OAuth Setup (Phase 2)**
  - [ ] Developer account created on TikTok Developer Console
  - [ ] OAuth app created with credentials
  - [ ] Redirect URI registered: `https://{railway-domain}/workspace/accounts/callback?provider=tiktok`

---

## Payment & Webhooks

- [ ] **Mercado Pago Integration**
  - [ ] MERCADOPAGO_ACCESS_TOKEN set (TEST- for sandbox testing)
  - [ ] Checkout flow works (users can proceed to payment)
  - [ ] Payment success redirects to PAYMENT_SUCCESS_URL
  - [ ] Payment cancellation redirects to PAYMENT_CANCEL_URL

- [ ] **Webhook Configuration**
  - [ ] PAYMENT_WEBHOOK_URL registered in Mercado Pago Dashboard
  - [ ] Webhook endpoint is publicly accessible (https)
  - [ ] Signature verification implemented (MERCADOPAGO_WEBHOOK_SECRET)
  - [ ] Webhook test passes in Mercado Pago dashboard
  - [ ] Payment notifications received and processed

- [ ] **Error Tracking for Payments**
  - [ ] Payment errors captured in Sentry
  - [ ] Webhook failures logged and tracked
  - [ ] Timeout errors (10s) captured with context

---

## Storage & Media

- [ ] **R2 Bucket Configured**
  - [ ] Bucket created: `yt-multi-publi-prod-media`
  - [ ] Public access enabled (Block public access: OFF)
  - [ ] CORS rules configured:
    - Allowed Origins: `*` or specific TikTok/Instagram domains
    - Allowed Methods: GET, PUT, POST, DELETE
    - Allowed Headers: `*`

- [ ] **R2 API Credentials Working**
  - [ ] R2_ACCESS_KEY_ID and R2_ACCESS_KEY_SECRET valid
  - [ ] Test upload/download works
  - [ ] Public URLs accessible (not requiring authentication)
  - [ ] Videos downloadable by TikTok/Instagram

- [ ] **Media Upload Verified**
  - [ ] Users can upload video files
  - [ ] Files stored in R2 bucket
  - [ ] Public URLs generated and work
  - [ ] Thumbnails generated and stored

---

## Error Tracking & Monitoring

- [ ] **Sentry Receiving Errors**
  - [ ] SENTRY_DSN configured in Railway
  - [ ] Application initializes Sentry on startup
  - [ ] Test error endpoint triggers Sentry event
  - [ ] Errors appear in Sentry dashboard within 30 seconds
  - [ ] Error context includes HTTP method, URL, user info

- [ ] **Sentry Quota Monitoring**
  - [ ] Free tier limit understood (5,000 events/month)
  - [ ] Error volume estimated and under quota
  - [ ] Plan for upgrade if volume exceeds quota

- [ ] **Application Logs**
  - [ ] Railway logs accessible and readable
  - [ ] Error logs contain stack traces
  - [ ] Performance metrics logged (response times)
  - [ ] No sensitive data in logs (secrets not logged)

---

## Security & Secrets

- [ ] **No Secrets in Git**
  - [ ] Credentials NOT hardcoded in `.env.production` file
  - [ ] All secrets stored in Railway Variables only
  - [ ] `.env.example` contains only templates and placeholders
  - [ ] Verified: `git log -p | grep -i "sk_\|token\|secret" | wc -l` = 0

- [ ] **API Token Rotation**
  - [ ] R2 API tokens have expiration set
  - [ ] OAuth tokens refreshed automatically (if needed)
  - [ ] Webhook secret is strong and unique

- [ ] **Environment Isolation**
  - [ ] Staging uses different credentials than production
  - [ ] Staging uses TEST Mercado Pago credentials (not PROD)
  - [ ] Staging uses separate R2 bucket

---

## Deployment & Rollback

- [ ] **Railway Deployment Working**
  - [ ] GitHub Actions workflow triggers on push to main
  - [ ] Railway auto-deploys after successful tests
  - [ ] Deployment completes within 5 minutes
  - [ ] No deployment errors in Railway logs

- [ ] **Health Check Passing**
  - [ ] `/api/health` endpoint returns HTTP 200
  - [ ] Response includes status: "ok"
  - [ ] Health check verifies database connectivity
  - [ ] Can be accessed publicly (no auth required)

- [ ] **Rollback Procedure Documented & Tested**
  - [ ] Previous deployments visible in Railway dashboard
  - [ ] Can redeploy previous stable version (< 5 minutes)
  - [ ] Git revert strategy works if needed
  - [ ] Database rollback procedure known (Railway backups)

---

## Smoke Tests

### Before Production Launch, Run These Tests

- [ ] **Health Check**
  ```bash
  curl https://{railway-domain}/api/health
  # Expected: HTTP 200, body contains "ok"
  ```

- [ ] **OAuth Login Flow**
  - [ ] Can initiate Google login
  - [ ] Redirect to Google consent screen works
  - [ ] Callback to application succeeds
  - [ ] Session created and user logged in

- [ ] **Payment Checkout**
  - [ ] Can create checkout session
  - [ ] Redirected to Mercado Pago
  - [ ] Payment flow works (even if not completed)
  - [ ] Can return from checkout (success/cancel URL)

- [ ] **Media Upload & Download**
  - [ ] Can upload video file
  - [ ] File stored in R2 bucket
  - [ ] Public URL accessible
  - [ ] Video plays/downloads correctly

- [ ] **Webhook Reception**
  - [ ] Mercado Pago can post to webhook endpoint
  - [ ] Webhook signature verified correctly
  - [ ] Payment status updated after webhook
  - [ ] Errors logged if webhook processing fails

- [ ] **Sentry Error Capture**
  - [ ] Trigger test error (if endpoint available)
  - [ ] Error appears in Sentry within 30 seconds
  - [ ] Error context includes full details

---

## Performance & Load Testing

- [ ] **Response Times Acceptable**
  - [ ] Health check: < 100ms
  - [ ] Login: < 2 seconds
  - [ ] Checkout: < 2 seconds
  - [ ] Media upload: < 10 seconds (file dependent)
  - [ ] Media download: > 1 Mbps (network dependent)

- [ ] **No Obvious Memory Leaks**
  - [ ] Memory usage stable over time
  - [ ] No gradual increase in RAM consumption
  - [ ] No crash due to out-of-memory

- [ ] **Database Performance**
  - [ ] Query latency < 100ms for typical queries
  - [ ] No slow query logs
  - [ ] Connection pool not exhausted

---

## Documentation

- [ ] **Deployment Guide Created**
  - [ ] File: `docs/DEPLOYMENT.md`
  - [ ] Contains step-by-step deployment instructions
  - [ ] Includes troubleshooting guide
  - [ ] Smoke test procedures documented
  - [ ] Rollback procedure documented

- [ ] **Environment Template Updated**
  - [ ] `.env.example` contains all required variables
  - [ ] Comments explain each variable's purpose
  - [ ] Instructions on where to find credentials

- [ ] **Production Checklist Created**
  - [ ] This file created and regularly updated
  - [ ] All items tracked and signed off

---

## Final Approval

### Ready for Production Launch?

- [ ] All items above are CHECKED OFF
- [ ] No known critical issues
- [ ] Staging deployment successful
- [ ] All smoke tests passing
- [ ] Team has reviewed and approved

**Decision:**  
- [ ] APPROVED FOR PRODUCTION LAUNCH
- [ ] HOLD - Needs further testing
- [ ] BLOCKED - Critical issue must be fixed

**Decision Date:** _________________  
**Approved By:** _________________  
**Sign-Off:** _________________

---

## Post-Launch Monitoring (First 24 Hours)

After going live, monitor continuously:

- [ ] Check error rate in Sentry (should be low)
- [ ] Monitor Railway metrics (CPU, memory, network)
- [ ] Watch application logs for warnings/errors
- [ ] Verify webhooks are being received
- [ ] Check storage usage growth (R2)
- [ ] Test critical user flows (login, checkout, upload)

---

## Sign-Off History

| Date | Status | Notes |
|------|--------|-------|
| | | |
| | | |
| | | |

---

**Last Updated:** 2026-04-28  
**Next Review:** After Phase 1 Verification Complete
