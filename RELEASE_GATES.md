# Release Gates: YT Multi-Publisher v1

**Phase:** 05-02 Launch Readiness  
**Source of functional evidence:** `GO_LIVE_CHECKLIST.md`  
**Owner model:** Solo launch (`Lucas (Tech Lead)` primary and fallback)

---

## Gate Rules

1. Any gate with `Blocker=YES` failing means launch is `HOLD` unless explicitly waived.
2. Waivers for blocker gates must include rationale, risk owner, and rollback trigger.
3. SLA is the max verification time before escalation.
4. Evidence must be attached in `LAUNCH_SIGN_OFF.md`.

---

## Gate Matrix

| Gate ID | Gate Name | Evidence Required | Owner | Fallback Owner | SLA (min) | Blocker |
|---|---|---|---|---|---:|---|
| GATE-INF-01 | App reachable over HTTPS | `curl https://{app-domain}/api/health` returns healthy | Lucas (Tech Lead) | Lucas (Tech Lead) | 5 | YES |
| GATE-INF-02 | API readiness healthy | `curl https://{app-domain}/api/ready` returns ready | Lucas (Tech Lead) | Lucas (Tech Lead) | 5 | YES |
| GATE-INF-03 | Deployment target correct | Current deploy matches intended commit/release tag | Lucas (Tech Lead) | Lucas (Tech Lead) | 5 | YES |
| GATE-ENV-01 | Required env vars set | Verified app vars for OAuth, payment, DB, app URL | Lucas (Tech Lead) | Lucas (Tech Lead) | 10 | YES |
| GATE-ENV-02 | Public URL and callbacks valid | OAuth redirect URIs and webhook URLs match deployed domain | Lucas (Tech Lead) | Lucas (Tech Lead) | 10 | YES |
| GATE-DB-01 | Prisma startup check passes | `node --env-file-if-exists=.env scripts/verify-prisma-startup.cjs --skip-generate` | Lucas (Tech Lead) | Lucas (Tech Lead) | 10 | YES |
| GATE-DB-02 | Migration state stable | No pending critical migration issues in target environment | Lucas (Tech Lead) | Lucas (Tech Lead) | 10 | YES |
| GATE-AUTH-01 | Google OAuth login works | `GO_LIVE_CHECKLIST.md` auth step 1.1 = PASS | Lucas (Tech Lead) | Lucas (Tech Lead) | 10 | YES |
| GATE-AUTH-02 | TikTok OAuth connect works | `GO_LIVE_CHECKLIST.md` auth step 1.2 = PASS | Lucas (Tech Lead) | Lucas (Tech Lead) | 10 | YES |
| GATE-AUTH-03 | Instagram OAuth connect works | `GO_LIVE_CHECKLIST.md` auth step 1.3 = PASS | Lucas (Tech Lead) | Lucas (Tech Lead) | 10 | YES |
| GATE-AUTH-04 | Session and logout controls | `GO_LIVE_CHECKLIST.md` auth steps 1.4 + 1.5 = PASS | Lucas (Tech Lead) | Lucas (Tech Lead) | 10 | YES |
| GATE-PAY-01 | Checkout creation works | `GO_LIVE_CHECKLIST.md` payment step 2.1 = PASS | Lucas (Tech Lead) | Lucas (Tech Lead) | 10 | YES |
| GATE-PAY-02 | Sandbox payment completes | `GO_LIVE_CHECKLIST.md` payment step 2.2 = PASS | Lucas (Tech Lead) | Lucas (Tech Lead) | 15 | YES |
| GATE-PAY-03 | Token crediting correct | `GO_LIVE_CHECKLIST.md` payment step 2.3 = PASS | Lucas (Tech Lead) | Lucas (Tech Lead) | 10 | YES |
| GATE-PAY-04 | Webhook idempotency safe | `GO_LIVE_CHECKLIST.md` payment step 2.4 = PASS | Lucas (Tech Lead) | Lucas (Tech Lead) | 15 | YES |
| GATE-INT-01 | YouTube publish flow passes | `GO_LIVE_CHECKLIST.md` multi-platform steps 3.1 + 3.2 = PASS | Lucas (Tech Lead) | Lucas (Tech Lead) | 15 | YES |
| GATE-INT-02 | TikTok publish flow passes | `GO_LIVE_CHECKLIST.md` multi-platform step 3.3 = PASS | Lucas (Tech Lead) | Lucas (Tech Lead) | 20 | YES |
| GATE-INT-03 | Instagram publish flow passes | `GO_LIVE_CHECKLIST.md` multi-platform step 3.4 = PASS | Lucas (Tech Lead) | Lucas (Tech Lead) | 20 | YES |
| GATE-INT-04 | Multi-destination publish isolation | `GO_LIVE_CHECKLIST.md` multi-platform step 3.5 = PASS | Lucas (Tech Lead) | Lucas (Tech Lead) | 20 | YES |
| GATE-INT-05 | Status persistence after refresh | `GO_LIVE_CHECKLIST.md` multi-platform step 3.6 = PASS | Lucas (Tech Lead) | Lucas (Tech Lead) | 10 | YES |
| GATE-OBS-01 | Error tracking available | Sentry/monitoring receives and displays runtime errors | Lucas (Tech Lead) | Lucas (Tech Lead) | 10 | HIGH |
| GATE-OBS-02 | Logs readable for incident triage | Runtime logs accessible with recent request/job traces | Lucas (Tech Lead) | Lucas (Tech Lead) | 10 | HIGH |
| GATE-SEC-01 | Secrets not exposed in logs | Spot check logs for API keys/tokens leakage | Lucas (Tech Lead) | Lucas (Tech Lead) | 10 | YES |
| GATE-SEC-02 | TLS and cookie safety intact | HTTPS enforced, session behavior consistent with auth checks | Lucas (Tech Lead) | Lucas (Tech Lead) | 10 | HIGH |
| GATE-TST-01 | Focused regression tests pass | `npx vitest run tests/phase2/campaign-wizard-ui.test.tsx tests/phase7/campanhas-api-integration.test.ts tests/phase107 tests/phase108` | Lucas (Tech Lead) | Lucas (Tech Lead) | 30 | YES |
| GATE-OPS-01 | Rollback contacts and trigger known | Rollback trigger condition documented before go decision | Lucas (Tech Lead) | Lucas (Tech Lead) | 10 | YES |
| GATE-OPS-02 | Launch comms ready | Internal launch update template prepared | Lucas (Tech Lead) | Lucas (Tech Lead) | 10 | MEDIUM |

---

## Waiver Policy

For a gate waiver, record:
- Gate ID
- Reason for waiver
- Risk owner
- Compensating control
- Rollback trigger condition

Blocker waivers should be exceptional and time-bounded.

