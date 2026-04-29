# Go-Live Verification Checklist: YT Multi-Publisher v1

**Created:** 2026-04-28  
**Environment:** Staging or Production  
**Verified By:** ____________________

---

## How To Use This Checklist

1. Run each verification step in order.
2. Record command/path, observed result, and PASS/FAIL.
3. If any blocker fails, stop and open incident + fix plan.
4. If all blockers pass, proceed to launch gate review.
5. Archive this completed checklist with timestamp and owner.

Severity:
- `blocker`: launch must stop.
- `high`: launch proceeds only with explicit owner acceptance.
- `medium`: launch may proceed with post-launch action owner and due date.

---

## Verification 1: Authentication Flow

### Objective
Verify OAuth login/session behavior and connected account management.

### Prerequisites
- App available at `https://{app-domain}`.
- OAuth credentials configured for Google/TikTok/Instagram.
- Test user account exists.

### Steps

#### 1.1 Google OAuth Login (`blocker`)

Path: `https://{app-domain}/login`

1. Click `Sign in with Google`.
2. Complete login with test account.
3. Confirm redirect to workspace page.
4. Confirm protected pages are accessible.

Expected:
- Login succeeds.
- Redirect works.
- Authenticated page loads.

Result: [ ] PASS [ ] FAIL  
Evidence: ____________________

#### 1.2 TikTok OAuth Connection (`blocker`)

Path: `/workspace/accounts`

1. Click `Connect TikTok`.
2. Complete consent.
3. Confirm redirect back to accounts page.
4. Confirm TikTok account appears connected.

Expected:
- OAuth flow completes.
- Account status is active/connected.

Result: [ ] PASS [ ] FAIL  
Evidence: ____________________

#### 1.3 Instagram OAuth Connection (`blocker`)

Path: `/workspace/accounts`

1. Click `Connect Instagram`.
2. Complete consent.
3. Confirm redirect back to accounts page.
4. Confirm Instagram account appears connected.

Expected:
- OAuth flow completes.
- Account status is active/connected.

Result: [ ] PASS [ ] FAIL  
Evidence: ____________________

#### 1.4 Session Persistence (`high`)

1. Close tab after login.
2. Re-open `https://{app-domain}/workspace/dashboard`.

Expected:
- Session still valid.
- No forced re-login.

Result: [ ] PASS [ ] FAIL  
Evidence: ____________________

#### 1.5 Logout Protection (`blocker`)

1. Click logout.
2. Open a protected route directly.

Expected:
- User is redirected to login.

Result: [ ] PASS [ ] FAIL  
Evidence: ____________________

### Authentication Summary

| Scenario | Severity | Result | Notes |
|---|---|---|---|
| Google OAuth Login | blocker | [ ] PASS / [ ] FAIL | |
| TikTok OAuth Connection | blocker | [ ] PASS / [ ] FAIL | |
| Instagram OAuth Connection | blocker | [ ] PASS / [ ] FAIL | |
| Session Persistence | high | [ ] PASS / [ ] FAIL | |
| Logout Protection | blocker | [ ] PASS / [ ] FAIL | |

Auth Gate: [ ] PASS [ ] FAIL

---

## Verification 2: Payment Flow

### Objective
Verify checkout, webhook processing, and token crediting with idempotency safety.

### Prerequisites
- Mercado Pago credentials configured.
- Webhook endpoint configured.
- Test plan and test user account available.

### Steps

#### 2.1 Create Checkout Session (`blocker`)

Path: `/workspace/planos`

1. Select a paid plan.
2. Start checkout.
3. Confirm redirect to Mercado Pago checkout.

Expected:
- Checkout initializes successfully.
- Correct plan and user details shown.

Result: [ ] PASS [ ] FAIL  
Evidence: ____________________

#### 2.2 Complete Sandbox Payment (`blocker`)

1. Complete payment with sandbox method.
2. Confirm return to app success page/workspace.
3. Review logs for webhook receive and confirm events.

Expected:
- Payment succeeds.
- Webhook processed.
- No server errors.

Result: [ ] PASS [ ] FAIL  
Evidence: ____________________

#### 2.3 Verify Token Crediting (`blocker`)

Path: workspace dashboard (and optional DB query)

1. Check token balance in UI.
2. Optionally validate DB row for user token balance.

Expected:
- Token credit matches purchased plan.

Result: [ ] PASS [ ] FAIL  
Evidence: ____________________

#### 2.4 Webhook Idempotency (`blocker`)

1. Check webhook/payment logs for duplicate processing.
2. Confirm balance was not credited twice.

Expected:
- Single logical credit for one payment.

Result: [ ] PASS [ ] FAIL  
Evidence: ____________________

### Payment Summary

| Scenario | Severity | Result | Notes |
|---|---|---|---|
| Create Checkout Session | blocker | [ ] PASS / [ ] FAIL | |
| Complete Sandbox Payment | blocker | [ ] PASS / [ ] FAIL | |
| Verify Token Crediting | blocker | [ ] PASS / [ ] FAIL | |
| Webhook Idempotency | blocker | [ ] PASS / [ ] FAIL | |

Payment Gate: [ ] PASS [ ] FAIL

---

## Verification 3: Multi-Platform Campaign Publishing

### Objective
Verify campaign creation and publish status across YouTube, TikTok, and Instagram.

### Prerequisites
- Auth and payment gates passed.
- Connected accounts available for all platforms.
- Test video asset available.

### Steps

#### 3.1 Create Campaign for YouTube (`blocker`)

Path: `/workspace/campanhas`

1. Create a new campaign with one YouTube destination.
2. Save draft/ready campaign.

Expected:
- Campaign created.
- Target appears correctly.

Result: [ ] PASS [ ] FAIL  
Evidence: ____________________

#### 3.2 Publish to YouTube (`blocker`)

1. Launch publish for YouTube target.
2. Observe status transitions.

Expected:
- No fatal error.
- Target reaches published/success status.

Result: [ ] PASS [ ] FAIL  
Evidence: ____________________

#### 3.3 Create + Publish TikTok Campaign (`blocker`)

1. Create campaign with TikTok destination.
2. Launch publish.
3. Observe completion.

Expected:
- Target reaches published/success status.

Result: [ ] PASS [ ] FAIL  
Evidence: ____________________

#### 3.4 Create + Publish Instagram Campaign (`blocker`)

1. Create campaign with Instagram destination.
2. Launch publish.
3. Observe completion.

Expected:
- Target reaches published/success status.

Result: [ ] PASS [ ] FAIL  
Evidence: ____________________

#### 3.5 Multi-Destination Campaign (`high`)

1. Create one campaign with YouTube + TikTok + Instagram.
2. Launch publish for all destinations.
3. Confirm per-destination statuses are independent.

Expected:
- All selected destinations process correctly.
- One platform failure does not corrupt other status rows.

Result: [ ] PASS [ ] FAIL  
Evidence: ____________________

#### 3.6 Status Persistence (`high`)

1. Refresh campaigns page.
2. Re-open campaign details.

Expected:
- Published/failure statuses persist after reload.

Result: [ ] PASS [ ] FAIL  
Evidence: ____________________

### Multi-Platform Summary

| Scenario | Severity | Result | Notes |
|---|---|---|---|
| Create Campaign for YouTube | blocker | [ ] PASS / [ ] FAIL | |
| Publish to YouTube | blocker | [ ] PASS / [ ] FAIL | |
| Create + Publish TikTok Campaign | blocker | [ ] PASS / [ ] FAIL | |
| Create + Publish Instagram Campaign | blocker | [ ] PASS / [ ] FAIL | |
| Multi-Destination Campaign | high | [ ] PASS / [ ] FAIL | |
| Status Persistence | high | [ ] PASS / [ ] FAIL | |

Multi-Platform Gate: [ ] PASS [ ] FAIL

---

## Overall Go-Live Decision

Authentication Gate: [ ] PASS [ ] FAIL  
Payment Gate: [ ] PASS [ ] FAIL  
Multi-Platform Gate: [ ] PASS [ ] FAIL

Overall:
- [ ] GO TO LAUNCH
- [ ] HOLD (fix required before launch)

Blocking Failures:
____________________________________________________
____________________________________________________

Approvals:
- Verified by: ____________________
- Date/time: ____________________
- Evidence location: ____________________

---

## Command Reference

```bash
# Health
curl -s https://{app-domain}/api/health

# Optional readiness
curl -s https://{app-domain}/api/ready

# Prisma startup verification (local/staging shell)
node --env-file-if-exists=.env scripts/verify-prisma-startup.cjs --skip-generate

# Focused automated checks (local CI-style pass before launch window)
npx vitest run tests/phase2/campaign-wizard-ui.test.tsx tests/phase7/campanhas-api-integration.test.ts tests/phase107 tests/phase108

# Platform smoke scripts (deployed environment)
BASE_URL=https://{app-domain} ./scripts/smoke-test-tiktok.sh
BASE_URL=https://{app-domain} ./scripts/smoke-test-instagram.sh
```

---

## Evidence Log Template

| Timestamp (UTC) | Environment | Step | Command/Path | Result | Severity | Owner | Notes |
|---|---|---|---|---|---|---|---|
| | | | | PASS/FAIL | blocker/high/medium | | |

