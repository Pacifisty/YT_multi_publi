# Go-Live Verification Checklist: YT Multi-Publisher v1

**Created:** 2026-04-28  
**Environment:** Production (or Staging if pre-flight)  
**Verified By:** [Executor name]

---

## How to Use This Checklist

1. Run each verification step IN ORDER
2. For each step: note the command, observe the result, record PASS or FAIL
3. If a step fails, do NOT proceed — document the failure and stop
4. If all steps pass, the application is ready for launch
5. Archive this completed checklist for audit/regulatory purposes

**Note:** This checklist is repeatable. Run it again before each launch attempt.

---

## Verification 1: Authentication Flow

### Objective
Verify that users can connect OAuth accounts (Google, TikTok, Instagram) and maintain authenticated sessions.

### Prerequisites
- Application is deployed and accessible at {railway-domain}
- Google OAuth credentials configured in .env.production
- TikTok OAuth credentials configured (if applicable)
- Staging users available for testing

### Verification Steps

#### 1.1 — Google OAuth Login

**Command:** Browser test

**Steps:**
1. Open https://{railway-domain}/login
2. Click "Sign in with Google"
3. Log in with test account (e.g., user@example.com)
4. Verify redirect: Should land on /workspace/dashboard
5. Verify session: Open developer console → Application → Cookies
6. Look for session cookie (e.g., "next-auth.session-token")
   - Session cookie should have Secure flag (HTTPS only)
   - Should have HttpOnly flag (JavaScript can't access)

**Expected Result:**
- ✓ Login succeeds without errors
- ✓ Redirect to dashboard works
- ✓ Session cookie created with Secure + HttpOnly flags
- ✓ Can access authenticated pages (dashboard loads)

**Result:** [ ] PASS   [ ] FAIL

**Evidence:** Screenshot of dashboard or session cookie in dev tools

**Notes:** [Executor can add observations]

---

#### 1.2 — TikTok OAuth Connection

**Command:** Browser test

**Steps:**
1. While logged in, navigate to /workspace/accounts
2. Click "Connect TikTok"
3. Authorize TikTok OAuth (use test TikTok account)
4. Verify redirect back to /workspace/accounts
5. Verify TikTok account appears in accounts list

**Expected Result:**
- ✓ OAuth flow completes without errors
- ✓ Account added to database (check accounts list)
- ✓ Access token received and stored

**Result:** [ ] PASS   [ ] FAIL

**Evidence:** Screenshot of accounts list showing TikTok account

**Notes:**

---

#### 1.3 — Instagram OAuth Connection (if applicable)

**Command:** Browser test

**Steps:**
1. While logged in, navigate to /workspace/accounts
2. Click "Connect Instagram"
3. Authorize Instagram OAuth
4. Verify redirect back to /workspace/accounts
5. Verify Instagram account appears in accounts list

**Expected Result:**
- ✓ OAuth flow completes without errors
- ✓ Account added to database
- ✓ Access token received and stored

**Result:** [ ] PASS   [ ] FAIL

**Evidence:** Screenshot of accounts list showing Instagram account

**Notes:**

---

#### 1.4 — Session Persistence

**Command:** Browser test

**Steps:**
1. While logged in, close the browser tab
2. Open a new tab and visit https://{railway-domain}/workspace/dashboard
3. Verify user is still logged in (no redirect to /login)

**Expected Result:**
- ✓ Session persists across tab closes
- ✓ No login required on page refresh

**Result:** [ ] PASS   [ ] FAIL

**Evidence:**

**Notes:**

---

#### 1.5 — Logout

**Command:** Browser test

**Steps:**
1. While logged in, click user menu → "Sign Out"
2. Verify redirect to /login
3. Try to access /workspace/dashboard
4. Verify redirect to /login (not authenticated)

**Expected Result:**
- ✓ Logout clears session
- ✓ Protected pages redirect to login

**Result:** [ ] PASS   [ ] FAIL

**Evidence:**

**Notes:**

---

### Authentication Verification Summary

| Scenario | Result | Notes |
|----------|--------|-------|
| Google OAuth | [ ] PASS / [ ] FAIL | |
| TikTok OAuth | [ ] PASS / [ ] FAIL | |
| Instagram OAuth | [ ] PASS / [ ] FAIL | |
| Session Persistence | [ ] PASS / [ ] FAIL | |
| Logout | [ ] PASS / [ ] FAIL | |

**Auth Flow Status:** [ ] ALL PASS → Proceed to Payment Verification   [ ] ANY FAIL → STOP

---

## Verification 2: Payment Flow

### Objective
Verify that users can initiate checkout and receive payment confirmation.

### Prerequisites
- Mercado Pago credentials configured in .env.production
- Staging merchant account set up
- Webhook URL registered in Mercado Pago (e.g., https://{railway-domain}/api/webhooks/mercado-pago)
- Test user account with TikTok/Instagram connected (from Verification 1)

### Verification Steps

#### 2.1 — Create Checkout Session

**Command:** Browser test

**Steps:**
1. Log in with test account
2. Navigate to /workspace/planos (pricing/checkout page)
3. Select a plan (e.g., "Starter")
4. Click "Subscribe" or "Checkout"
5. Verify redirect to Mercado Pago checkout page
   - Should show plan name, price, user email
6. Do NOT complete payment (only verify redirect works)

**Expected Result:**
- ✓ /workspace/planos loads without error
- ✓ Plan selection works
- ✓ Redirect to Mercado Pago succeeds
- ✓ Checkout page shows correct amount and user email

**Result:** [ ] PASS   [ ] FAIL

**Evidence:** Screenshot of Mercado Pago checkout page

**Notes:**

---

#### 2.2 — Complete Test Payment

**Command:** Browser + Mercado Pago sandbox

**Steps:**
1. From checkout page, fill in test card details:
   - Card: 4111 1111 1111 1111
   - Expiry: 11/25
   - CVV: 123
2. Complete payment
3. Verify redirect back to app (success page or dashboard)
4. Check application logs for webhook delivery confirmation
   - Look for: "Webhook received" and "Payment confirmed"

**Expected Result:**
- ✓ Payment completes (Mercado Pago accepts card)
- ✓ Redirect back to app succeeds
- ✓ Webhook received and logged
- ✓ User status updated to "active" or similar

**Result:** [ ] PASS   [ ] FAIL

**Evidence:** 
- Screenshot of success page
- Screenshot of webhook log entry (Railway logs or Sentry)

**Notes:**

---

#### 2.3 — Verify Token Crediting

**Command:** Browser + database check

**Steps:**
1. After payment completes, log in and check workspace/dashboard
2. Verify tokens/credits appear:
   - Should see "Monthly Tokens: X" or similar
3. Optional: Check database directly
   ```bash
   psql {DATABASE_URL} -c "SELECT email, tokens_remaining FROM users WHERE email='test@example.com'"
   ```

**Expected Result:**
- ✓ Tokens/credits visible in dashboard
- ✓ Token count matches purchased plan (e.g., 1000 tokens for Starter)
- ✓ Database query confirms token update

**Result:** [ ] PASS   [ ] FAIL

**Evidence:** Screenshot of dashboard showing tokens

**Notes:**

---

#### 2.4 — Webhook Idempotency

**Command:** Manual (simulates duplicate webhook)

**Steps:**
1. In Mercado Pago dashboard, find the payment you just made
2. Look for webhook delivery history (if available)
3. Verify webhook was delivered once (not multiple times)
4. In application logs, search for duplicate "Payment confirmed" messages
   - Expected: ONE confirmation message
   - If seen: Multiple messages = idempotency failure

**Expected Result:**
- ✓ Webhook delivered exactly once
- ✓ No duplicate token crediting
- ✓ User has correct token count (not double-charged)

**Result:** [ ] PASS   [ ] FAIL

**Evidence:** Screenshot of webhook logs

**Notes:**

---

### Payment Verification Summary

| Scenario | Result | Notes |
|----------|--------|-------|
| Create Checkout Session | [ ] PASS / [ ] FAIL | |
| Complete Test Payment | [ ] PASS / [ ] FAIL | |
| Token Crediting | [ ] PASS / [ ] FAIL | |
| Webhook Idempotency | [ ] PASS / [ ] FAIL | |

**Payment Flow Status:** [ ] ALL PASS → Proceed to Multi-Platform Verification   [ ] ANY FAIL → STOP

---

## Verification 3: Multi-Platform Campaign Publishing

### Objective
Verify that campaigns can be created and published to YouTube, TikTok, and Instagram with correct status tracking.

### Prerequisites
- User logged in with active tokens (from Verification 2)
- YouTube account connected (should already be connected)
- TikTok account connected (from Verification 1)
- Instagram account connected (from Verification 1)
- Test video file available (e.g., sample.mp4, 30-60 seconds, vertical format)

### Verification Steps

#### 3.1 — Create Campaign (YouTube)

**Command:** Browser test

**Steps:**
1. Navigate to /workspace/campaigns
2. Click "New Campaign"
3. Fill in:
   - Name: "Test Campaign YouTube"
   - Description: "GO-LIVE test"
   - Select video file (test.mp4)
4. In "Targets" section, select YouTube channel(s)
5. Click "Create Campaign"
6. Verify campaign appears in campaigns list with status "pending" or "ready"

**Expected Result:**
- ✓ Campaign created successfully
- ✓ Video uploaded to storage (R2)
- ✓ Campaign shows in list with YouTube target selected
- ✓ Status shows "pending" (waiting for publish)

**Result:** [ ] PASS   [ ] FAIL

**Evidence:** Screenshot of campaign in list

**Notes:**

---

#### 3.2 — Publish to YouTube

**Command:** Browser test

**Steps:**
1. From campaigns list, click the campaign just created
2. Click "Publish to YouTube"
3. Verify no errors appear
4. Wait up to 2 minutes for status to change
5. Verify status updates: "publishing" → "published" or "success"

**Expected Result:**
- ✓ Publish action accepted (no 500 errors)
- ✓ Status changes from "pending" to "publishing" then "published"
- ✓ No errors in application logs

**Result:** [ ] PASS   [ ] FAIL

**Evidence:** Screenshot showing status as "published"

**Notes:** (YouTube uploads may take 1-2 minutes; this is normal)

---

#### 3.3 — Create and Publish to TikTok

**Command:** Browser test

**Steps:**
1. Create new campaign (steps same as 3.1, but name: "Test Campaign TikTok")
2. Select TikTok account in Targets section
3. Click "Create Campaign"
4. Once created, click "Publish to TikTok"
5. Wait up to 3 minutes for status to change
6. Verify status: "published" or "success"

**Expected Result:**
- ✓ Campaign created with TikTok target
- ✓ Publish action accepted
- ✓ Status updates to "published"

**Result:** [ ] PASS   [ ] FAIL

**Evidence:** Screenshot of TikTok campaign status

**Notes:** (TikTok uploads typically take 1-3 minutes due to their processing)

---

#### 3.4 — Create and Publish to Instagram (if applicable)

**Command:** Browser test

**Steps:**
1. Create new campaign with name: "Test Campaign Instagram"
2. Select Instagram account in Targets section
3. Click "Create Campaign"
4. Once created, click "Publish to Instagram"
5. Wait up to 3 minutes for status to change
6. Verify status: "published" or "success"

**Expected Result:**
- ✓ Campaign created with Instagram target
- ✓ Publish action accepted
- ✓ Status updates to "published"

**Result:** [ ] PASS   [ ] FAIL

**Evidence:** Screenshot of Instagram campaign status

**Notes:** (If Instagram account not available, mark as N/A but document reason)

---

#### 3.5 — Multi-Platform Campaign (All Targets)

**Command:** Browser test

**Steps:**
1. Create new campaign: "Test Campaign All Platforms"
2. In Targets section, select ALL platforms:
   - [ ] YouTube
   - [ ] TikTok
   - [ ] Instagram (if available)
3. Click "Create Campaign"
4. Verify campaign appears with all targets selected
5. Publish to all platforms (either one-by-one or bulk if available)
6. Wait up to 5 minutes for all statuses to update
7. Verify each platform shows status "published" or "success"

**Expected Result:**
- ✓ Multi-target campaign created
- ✓ All platforms selected without error
- ✓ Each platform shows published status independently
- ✓ No cross-platform interference (TikTok doesn't affect YouTube status, etc.)

**Result:** [ ] PASS   [ ] FAIL

**Evidence:** Screenshot showing all platforms with published status

**Notes:**

---

#### 3.6 — Verify Campaign Status Persistence

**Command:** Browser test

**Steps:**
1. After all campaigns published, refresh the campaigns page
2. Verify published status persists (doesn't revert to "pending")
3. Click on one of the published campaigns
4. Verify campaign details load correctly

**Expected Result:**
- ✓ Status persists across page refresh
- ✓ Campaign details load without error
- ✓ Platform statuses remain correct

**Result:** [ ] PASS   [ ] FAIL

**Evidence:**

**Notes:**

---

### Multi-Platform Publishing Summary

| Scenario | Result | Notes |
|----------|--------|-------|
| Create & Publish to YouTube | [ ] PASS / [ ] FAIL | |
| Create & Publish to TikTok | [ ] PASS / [ ] FAIL | |
| Create & Publish to Instagram | [ ] PASS / [ ] FAIL | |
| Multi-Platform Campaign | [ ] PASS / [ ] FAIL | |
| Status Persistence | [ ] PASS / [ ] FAIL | |

**Multi-Platform Status:** [ ] ALL PASS → LAUNCH READY   [ ] ANY FAIL → STOP

---

## Overall Go-Live Decision

Based on the three verification flows above, determine launch readiness:

### Launch Readiness Assessment

**Authentication Flow:** [ ] PASS [ ] FAIL
**Payment Flow:** [ ] PASS [ ] FAIL  
**Multi-Platform Flow:** [ ] PASS [ ] FAIL

**Overall Status:**
- [ ] GO TO LAUNCH — All three flows passed, production ready
- [ ] HOLD — Some flows failed, requires fixes before launch
- [ ] ROLLBACK NOT NEEDED — No prior version to rollback to (this is initial launch)

**Failures (if any):**
[Executor documents any failures and root cause]

**Approval:**
- Verified By: [Name]
- Verified On: [Date/Time]
- Evidence Archived: [Location]

---

## Command Reference

Quick copy-paste commands for execution:

```bash
# Check health (after launch)
curl -s https://{railway-domain}/api/health | jq .

# View recent logs
railway logs --service {app-name} --tail 100

# Check webhook logs (if accessible via app)
# Depends on app logging infrastructure; see docs/DEPLOYMENT.md

# Database check (if accessible)
# psql {DATABASE_URL} -c "SELECT id, email FROM users LIMIT 5"
```

---
