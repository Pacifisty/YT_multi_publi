# Launch Sign-Off Template: YT Multi-Publisher v1

**Launch Window Start (UTC):** ____________________  
**Environment:** ____________________  
**Release Ref (commit/tag):** ____________________  
**Incident Channel:** ____________________

---

## Gate Status

Use `RELEASE_GATES.md` as source of truth for required gates and blocker status.

| Gate ID | Gate Name | Status (PASS/FAIL/WAIVED) | Evidence Link/Ref | Notes |
|---|---|---|---|---|
| GATE-INF-01 | App reachable over HTTPS | | | |
| GATE-INF-02 | API readiness healthy | | | |
| GATE-INF-03 | Deployment target correct | | | |
| GATE-ENV-01 | Required env vars set | | | |
| GATE-ENV-02 | Public URL and callbacks valid | | | |
| GATE-DB-01 | Prisma startup check passes | | | |
| GATE-DB-02 | Migration state stable | | | |
| GATE-AUTH-01 | Google OAuth login works | | | |
| GATE-AUTH-02 | TikTok OAuth connect works | | | |
| GATE-AUTH-03 | Instagram OAuth connect works | | | |
| GATE-AUTH-04 | Session and logout controls | | | |
| GATE-PAY-01 | Checkout creation works | | | |
| GATE-PAY-02 | Sandbox payment completes | | | |
| GATE-PAY-03 | Token crediting correct | | | |
| GATE-PAY-04 | Webhook idempotency safe | | | |
| GATE-INT-01 | YouTube publish flow passes | | | |
| GATE-INT-02 | TikTok publish flow passes | | | |
| GATE-INT-03 | Instagram publish flow passes | | | |
| GATE-INT-04 | Multi-destination publish isolation | | | |
| GATE-INT-05 | Status persistence after refresh | | | |
| GATE-OBS-01 | Error tracking available | | | |
| GATE-OBS-02 | Logs readable for incident triage | | | |
| GATE-SEC-01 | Secrets not exposed in logs | | | |
| GATE-SEC-02 | TLS and cookie safety intact | | | |
| GATE-TST-01 | Focused regression tests pass | | | |
| GATE-OPS-01 | Rollback contacts and trigger known | | | |
| GATE-OPS-02 | Launch comms ready | | | |

---

## Waivers

| Gate ID | Waiver Reason | Risk Owner | Compensating Control | Expiration |
|---|---|---|---|---|
| | | | | |

---

## Decision Checklist

- [ ] All `Blocker=YES` gates are `PASS` or explicitly `WAIVED`
- [ ] No unresolved critical incident
- [ ] Rollback trigger and operator are clear
- [ ] Stakeholder communication is ready

---

## Launch Decision

- [ ] GO TO PRODUCTION
- [ ] HOLD
- [ ] ABORT AND EXECUTE ROLLBACK

Decision Notes:
____________________________________________________
____________________________________________________

---

## Approvals

Primary Approver (Owner): ____________________  
Fallback Approver: ____________________  
Decision Timestamp (UTC): ____________________

