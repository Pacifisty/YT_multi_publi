# Production Deployment Guide

**Created:** 2026-04-28  
**Last Updated:** 2026-04-28  
**Environment:** Railway + Cloudflare R2 + Sentry  
**Status:** Ready for deployment

## Overview

This guide documents the complete deployment process for YT Multi-Publisher to production. The infrastructure uses:

- **Hosting:** Railway (auto-deployment from GitHub)
- **Storage:** Cloudflare R2 (public media URLs for TikTok/Instagram)
- **Database:** PostgreSQL (managed by Railway)
- **Error Tracking:** Sentry (error monitoring and debugging)
- **Monitoring:** Application logs + Sentry dashboard

---

## Pre-Deployment Checklist

Before proceeding with production deployment, ensure the following are complete:

- [ ] All `.env.production` variables configured in Railway dashboard
- [ ] Railway project created and GitHub repository linked
- [ ] Cloudflare R2 bucket created with API credentials
- [ ] Sentry project created with DSN configured
- [ ] PostgreSQL database provisioned (auto-created with Railway app)
- [ ] GitHub Actions workflow tested (at least one successful test run)
- [ ] OAuth redirect URIs updated in Google/TikTok consoles
- [ ] Mercado Pago webhook URL registered

---

## Step-by-Step Deployment

### 1. Create Railway Project

1. Go to https://railway.app and sign up/login
2. Click "New Project" → "Deploy from GitHub repo"
3. Select the YT Multi-Publisher repository
4. Railway will auto-detect Node.js and create a service

### 2. Configure Environment Variables in Railway

1. In Railway dashboard: Project Settings → Variables
2. Add all variables from `.env.production`:
   - `NODE_ENV=production`
   - `DATABASE_URL` (auto-populated by Railway)
   - `SENTRY_DSN` (from Sentry project)
   - R2 credentials (from Cloudflare)
   - Google OAuth credentials
   - Mercado Pago credentials
   - Payment URLs

3. Ensure no secrets are hardcoded in git (use Railway secrets only)

### 3. Set Up PostgreSQL Database

1. In Railway: Click "Add Service" → PostgreSQL
2. Railway auto-injects `DATABASE_URL` environment variable
3. This database is automatically provisioned and backed up daily

### 4. Create Cloudflare R2 Bucket

1. Go to https://dash.cloudflare.com and login
2. R2 → Create bucket → Name: `yt-multi-publi-prod-media`
3. Enable "Block public access": OFF (required for public URLs)
4. Settings → CORS Rules → Add:
   - Allowed Origins: `*` (or specific TikTok/Instagram domains)
   - Allowed Methods: GET, PUT, POST, DELETE
   - Allowed Headers: `*`

### 5. Create Sentry Project

1. Go to https://sentry.io and login
2. Create new project → Platform: Node.js
3. Copy DSN and add to `.env.production` as `SENTRY_DSN`
4. Dashboard → Integrations → Slack (optional for error alerts)

### 6. Configure OAuth Redirect URIs

**Google OAuth:**
1. Google Cloud Console → APIs & Services → Credentials
2. Edit OAuth 2.0 Client ID
3. Add authorized redirect URIs:
   - `https://{railway-domain}/workspace/accounts/callback`
   - `https://{railway-domain}/login/callback`

**TikTok OAuth (Phase 2):**
1. TikTok Developer Console → App Details
2. Update Redirect URI: `https://{railway-domain}/workspace/accounts/callback?provider=tiktok`

### 7. Register Mercado Pago Webhook

1. Mercado Pago Dashboard → Settings → Webhooks
2. Add new webhook endpoint:
   - URL: `https://{railway-domain}/api/account/payments/webhook`
   - Events: payment.created, payment.updated, payment.refunded
3. Save webhook and test with sandbox credentials first

### 8. Deploy to Production

**Automatic Deployment:**
- Push to `main` branch
- GitHub Actions workflow triggers automatically
- Railway auto-deploys within 1-2 minutes
- Monitor: https://railway.app → Project → Logs

**Manual Deployment (if needed):**
- In Railway dashboard: Click deploy button on the service
- Select the commit/branch to deploy

### 9. Verify Deployment

After deployment completes:

1. Check app is running: `curl https://{railway-domain}/api/health`
2. Verify database connection in logs
3. Check Sentry dashboard for any startup errors
4. Run smoke tests (see below)

---

## Health Check & Smoke Tests

### Health Check Endpoint

```bash
curl https://{railway-domain}/api/health
# Expected response: HTTP 200 OK
# Body: {"status": "ok"}
```

### Smoke Test Suite

Run these tests to verify production deployment is working:

#### 1. Authentication Flow Test

```bash
# 1. Start login flow
curl -X POST https://{railway-domain}/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Expected: HTTP 200 with session cookie or redirect URL
```

#### 2. Payment Checkout Test

```bash
# Create a checkout session (requires authentication)
curl -X POST https://{railway-domain}/api/account-plan/create-checkout \
  -H "Content-Type: application/json" \
  -d '{
    "plan": "PREMIUM",
    "successUrl": "https://{railway-domain}/workspace/planos?payment=success",
    "cancelUrl": "https://{railway-domain}/workspace/planos?payment=cancel"
  }'

# Expected: HTTP 200 with checkout URL (Mercado Pago)
```

#### 3. R2 Media Upload Test

```bash
# Upload test file to R2 (requires app to be running)
curl -X POST https://{railway-domain}/api/media/upload \
  -F "file=@test-video.mp4" \
  -H "Authorization: Bearer {session-token}"

# Expected: HTTP 200 with media asset ID and public URL
```

#### 4. Webhook Verification Test

```bash
# Test Mercado Pago webhook endpoint
curl -X POST https://{railway-domain}/api/account/payments/webhook \
  -H "Content-Type: application/json" \
  -H "x-signature: {signature}" \
  -d '{
    "action": "payment.created",
    "data": {"id": "test-payment-123"}
  }'

# Expected: HTTP 200 (webhook processed)
```

#### 5. Sentry Error Tracking Test

```bash
# This will intentionally trigger an error in production
# (Only run this if you want to verify Sentry is capturing errors)
curl -X POST https://{railway-domain}/api/test-error \
  -H "Content-Type: application/json"

# Check Sentry dashboard: New error should appear within 30 seconds
```

---

## Monitoring & Troubleshooting

### Application Logs

**View logs in Railway:**
1. Project dashboard → Service → Logs
2. Filter by error level: `ERROR`, `WARN`
3. Search for specific errors by keyword

### Sentry Dashboard

**Monitor errors:**
1. Go to https://sentry.io → Your Project
2. View real-time error events
3. Check error frequency, affected users, stack traces

**Error Context:**
- `payment` errors: Mercado Pago integration issues
- `webhook` errors: Webhook validation or processing failures
- `database` errors: PostgreSQL connection issues
- `storage` errors: R2 upload/download failures

### Performance Monitoring

**Railway metrics:**
- CPU usage
- Memory consumption
- Network I/O
- Request latency (average response time)

**Sentry insights:**
- Error rate (% of requests failing)
- Performance bottlenecks (slow endpoints)
- Memory leaks (if applicable)

---

## Common Deployment Issues & Solutions

### Issue: Database Connection Fails

**Symptoms:** Logs show `DATABASE_URL not found` or connection timeouts

**Solution:**
1. Verify `DATABASE_URL` is set in Railway Variables
2. Check PostgreSQL service is running: Railway → Logs → Look for "postgres"
3. Verify firewall: Railways auto-handles this
4. Test connection locally: `psql "$(echo $DATABASE_URL)"`

### Issue: OAuth Login Fails

**Symptoms:** "Invalid redirect URI" errors

**Solution:**
1. Get actual Railway domain: `https://{service-name}.railway.app`
2. Update Google/TikTok OAuth settings with exact domain
3. Wait 5 minutes for credentials to refresh
4. Clear browser cookies and retry login

### Issue: R2 Upload Returns 403 Forbidden

**Symptoms:** Media upload fails with 403 error

**Solution:**
1. Verify R2 bucket is public: Cloudflare R2 → Bucket → Settings → Block public access: OFF
2. Check API credentials: R2_ACCESS_KEY_ID, R2_ACCESS_KEY_SECRET in Railway Variables
3. Verify bucket name: R2_BUCKET_NAME must match created bucket name
4. Test R2 credentials locally: `aws s3 ls s3://{bucket-name} --endpoint-url https://{r2-endpoint}`

### Issue: Sentry Not Receiving Events

**Symptoms:** No errors appear in Sentry dashboard

**Solution:**
1. Verify SENTRY_DSN is set and valid in Railway Variables
2. Check NODE_ENV is set to "production"
3. Verify Sentry project is active (not paused)
4. Manually trigger an error to test: Use error endpoint
5. Check Sentry quota: Free tier = 5,000 events/month

### Issue: Webhook Signature Validation Fails

**Symptoms:** Mercado Pago webhooks return 400/401

**Solution:**
1. Verify MERCADOPAGO_WEBHOOK_SECRET is set in Railway Variables
2. Check webhook URL is publicly accessible and matches registered URL
3. Test webhook in Mercado Pago dashboard: Settings → Webhooks → Test
4. Verify signature generation matches Mercado Pago algorithm

### Issue: Payment Redirect Not Working

**Symptoms:** User completes checkout but not redirected to success page

**Solution:**
1. Verify PAYMENT_SUCCESS_URL and PAYMENT_CANCEL_URL match expected paths
2. Check URLs use https (not http)
3. Verify domain matches Railway domain
4. Ensure paths exist in your frontend

---

## Rollback Procedure

If deployment breaks production, follow these steps to rollback:

### Quick Rollback (< 5 minutes)

1. In Railway dashboard: Service → Deployments
2. Find the last stable deployment
3. Click "Redeploy" next to that deployment
4. Wait for Railway to complete deployment (~2 minutes)
5. Run health check to verify: `curl https://{railway-domain}/api/health`

### Full Rollback with Git Revert

If rollback deployment is insufficient:

1. Identify last stable commit: `git log --oneline | head -5`
2. Create revert commit: `git revert {broken-commit-hash}`
3. Push to main: `git push origin main`
4. GitHub Actions triggers deployment of reverted code
5. Verify health check passes

### Database Rollback (If Applicable)

If the deployment includes a database migration that broke schema:

1. Railway → Database (PostgreSQL) → Logs
2. Check if automatic backup exists: Yes (Railway auto-backs up daily)
3. Contact Railway support to restore from backup if needed
4. Do NOT manually restore unless guided by support

---

## Post-Deployment Verification

After successful deployment, verify:

1. **Application Status:**
   - [ ] Health endpoint returns 200
   - [ ] No errors in logs
   - [ ] Sentry shows no critical errors

2. **Database:**
   - [ ] Schema is correct (run `prisma migrate status`)
   - [ ] Tables exist and contain expected data
   - [ ] Indexes are created

3. **Storage:**
   - [ ] R2 bucket is accessible
   - [ ] Public URLs work (test download a file)
   - [ ] CORS rules are configured

4. **Integrations:**
   - [ ] OAuth login works (test with real Google account)
   - [ ] Payment checkout works (test with Mercado Pago sandbox)
   - [ ] Webhooks are received (check webhook logs)
   - [ ] Sentry is receiving errors (if any occur)

5. **Performance:**
   - [ ] Response time < 2 seconds for typical endpoints
   - [ ] No obvious memory leaks
   - [ ] CPU usage is reasonable

---

## Monitoring Strategy

### Daily Checks

- Review Sentry dashboard for new errors
- Check Railway logs for warnings
- Verify health endpoint is responsive

### Weekly Checks

- Review error trends (is error rate increasing?)
- Check storage usage (R2 and PostgreSQL)
- Monitor compute costs (are we on budget?)

### Monthly Checks

- Full smoke test suite
- Database backup verification
- Cost analysis (is pricing aligned with usage?)

---

## Deployment Automation

The GitHub Actions workflow (`.github/workflows/deploy.yml`) automates:

1. **On every push to `main`:**
   - Run linter (npm run lint)
   - Run tests (npm test)
   - Deploy to Railway (via GitHub integration)
   - Health check (wait for /api/health to return 200)
   - Optional Slack notification

2. **Configuration:**
   - Add `RAILWAY_TOKEN` to GitHub Secrets (optional, for manual deploys)
   - Add `SLACK_WEBHOOK_URL` to GitHub Secrets (optional, for notifications)
   - Update `RAILWAY_DOMAIN` in GitHub Secrets (for health check)

---

## Disaster Recovery

### Scenario: Data Loss / Database Corruption

1. Contact Railway support
2. Request restore from daily backup
3. Provide time/date of last known good state
4. Railway restores to specified point in time
5. Verify data integrity before going live

### Scenario: Security Breach / Leaked Credentials

1. Immediately rotate all credentials (Sentry DSN, R2 keys, etc.)
2. Update `.env.production` in Railway Variables
3. Re-deploy application
4. Revoke compromised API tokens:
   - R2: Create new API token, delete old one
   - Sentry: Regenerate DSN
   - Mercado Pago: Generate new webhook secret
5. Monitor logs for unauthorized access

### Scenario: DDoS / Performance Degradation

1. Check Sentry for error spikes
2. Review Railway metrics for resource exhaustion
3. Scale up (Railway → Service → Resources)
4. If attacked, enable Cloudflare DDoS protection
5. Monitor recovery

---

## Cost Optimization

### Monitoring Costs

- **Railway:** Check usage dashboard weekly
- **R2:** Monitor storage and bandwidth
- **Sentry:** Track error volume (5k free/month)

### Cost Reduction Strategies

If costs exceed budget:

1. Reduce PostgreSQL connection pool (Railway settings)
2. Implement media cleanup (delete old test uploads)
3. Defer non-critical error tracking to daily summaries
4. Use Sentry's sampling to reduce event ingestion

---

## Next Steps

After successful production deployment:

1. **Announce launch** — Inform users the app is live
2. **Monitor closely** — First 24 hours are critical
3. **Gather feedback** — Watch for user-reported issues
4. **Scale if needed** — Adjust resources based on actual usage
5. **Plan Phase 2** — Begin TikTok integration (infrastructure is ready)

---

## Support & Resources

- **Railway Docs:** https://docs.railway.app
- **Cloudflare R2 Docs:** https://developers.cloudflare.com/r2
- **Sentry Docs:** https://docs.sentry.io
- **Mercado Pago Docs:** https://www.mercadopago.com.br/developers

---

## Approval & Sign-Off

**Phase:** 1  
**Plan:** 01-02 (Setup & Deploy)  
**Status:** Ready for Production  
**Last Updated:** 2026-04-28

Document maintained by: Claude Code Agent
