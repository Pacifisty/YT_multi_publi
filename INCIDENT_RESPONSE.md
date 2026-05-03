# Production Incident Response Playbook: YT Multi-Publisher v1

**On-Call Owner:** Lucas (Tech Lead)  
**Last Updated:** 2026-04-29  
**Related Docs:** `RELEASE_GATES.md`, `ROLLBACK_PLAYBOOK.md`, `LAUNCH_SIGN_OFF.md`

---

## 1) Severity Levels

### SEV-1 (Critical)

Definition:
- Core service unavailable, payment/auth down, or data integrity at risk.

SLA:
- First response: 5 min
- Stabilization target: 15 min

Default action:
- Execute rollback flow immediately.

### SEV-2 (High)

Definition:
- Partial outage or major degraded feature (subset of users/features impacted).

SLA:
- First response: 15 min
- Stabilization target: 60 min

Default action:
- Patch or rollback depending on fastest safe recovery path.

### SEV-3 (Medium)

Definition:
- Degradation without major user-blocking impact.

SLA:
- First response: 60 min
- Resolution target: same business day

Default action:
- Monitor + plan fix; escalate if impact grows.

---

## 2) Gate Failure to Incident Mapping

| Gate Pattern | Incident Type | Severity | Rollback |
|---|---|---|---|
| `GATE-INF-*` health/readiness fail | Service unavailable | SEV-1 | Yes |
| `GATE-DB-*` fail | Database/schema incident | SEV-1 | Yes |
| `GATE-AUTH-*` fail | Authentication outage | SEV-1 | Yes |
| `GATE-PAY-*` fail | Payment outage | SEV-1 | Yes |
| `GATE-INT-02` / `GATE-INT-03` fail | Platform publish outage | SEV-2 | Conditional |
| `GATE-OBS-*` fail | Monitoring degradation | SEV-3 | No |
| `GATE-SEC-01` fail | Secret exposure risk | SEV-1 | Manual containment first |

---

## 3) First-Hour Response Workflow

### T+0 to T+5: Detect and Triage

1. Confirm signal source: alert, logs, user report.
2. Assign severity using section 1.
3. Open incident thread/document with timestamp.

### T+5 to T+15: Assess and Decide

1. Define blast radius:
   - all users or subset
   - one feature or platform
2. Decide recovery:
   - SEV-1: rollback
   - SEV-2: quick patch if safe, else rollback
   - SEV-3: monitor + scheduled patch
3. If rollback is selected, add an entry to the Rollback Decision Log before execution or immediately after the emergency action.

### T+15 to T+45: Execute and Verify

1. Execute chosen action.
2. Verify recovery:
   - health endpoints
   - critical gate samples
   - error trend

### T+45 to T+60: Communicate and Close Loop

1. Send update with:
   - current status
   - user impact
   - next checkpoint
2. If resolved:
   - publish closure note
   - record follow-ups

---

## 4) Rollback Decision Log

Every rollback decision must be recorded in the incident thread or launch evidence archive. Do not store secrets, raw tokens, database credentials, full customer payloads, or private provider responses in this log.

| Timestamp (UTC) | Decision | Trigger / Gate ID | Reason | Operator | Verification Result |
|---|---|---|---|---|---|
| | `rollback` / `patch` / `monitor` | | | | |

Required fields:
- Timestamp in UTC.
- Decision taken and operator.
- Triggering gate ID, error type, or incident signal.
- Short reason for the decision.
- Verification result after action.

---

## 5) Communication Templates

### Internal Alert

```text
INCIDENT ALERT
Severity: [SEV-1/SEV-2/SEV-3]
Type: [short label]
Detected at (UTC): [time]
Impact: [affected users/features]
Action in progress: [rollback/patch/monitor]
Next update: [time]
```

### Internal Status Update

```text
INCIDENT UPDATE
Status: [investigating/stabilizing/resolved]
What changed: [action + result]
Current impact: [scope]
Next action: [next step]
ETA: [if available]
```

### User-Facing Notice

```text
We are currently investigating an issue affecting [feature].
Our team is actively working on recovery.
Next update expected in [time window].
We apologize for the disruption.
```

### Post-Incident Summary

```text
Incident: [title]
Severity: [SEV-1/2/3]
Duration: [start-end]
Root cause: [short, no secrets]
Resolution: [rollback/patch]
User impact: [scope]
Evidence refs: [gate IDs and error types only]
Follow-ups: [action items + owners]
```

Post-incident summaries must reference gate IDs, error categories, and sanitized symptoms only. Never include API keys, OAuth tokens, payment secrets, raw webhook signatures, database credentials, customer private content, or full provider payloads.

---

## 6) On-Call Quick Checklist

- [ ] Classify severity
- [ ] Open incident record/thread
- [ ] Record rollback decision if rollback or emergency patch is selected
- [ ] Decide rollback vs patch
- [ ] Verify health + critical gates
- [ ] Send stakeholder update
- [ ] Capture follow-up actions
