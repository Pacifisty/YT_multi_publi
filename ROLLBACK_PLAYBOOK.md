# Production Rollback Playbook: YT Multi-Publisher v1

**Owner:** Lucas (Tech Lead)  
**Last Updated:** 2026-04-29  
**Escalation Contact:** support@railway.app

---

## 1) Rollback Decision Tree

```text
INCIDENT DETECTED
   |
   +--> Is severity CRITICAL?
         |        \
        YES        NO
         |          \
         |       Is data integrity at risk?
         |            |         \
         |           YES         NO
         |            |           |
         +------------+           |
         |                        |
    EXECUTE ROLLBACK         Patch/Monitor path
         |
   Verify health + gates
```

Immediate rollback triggers:
- `GATE-INF-01`, `GATE-INF-02`, `GATE-DB-01`, `GATE-AUTH-*`, `GATE-PAY-*` failing.
- Data corruption or migration break symptoms.
- Unrecoverable runtime errors after patch attempt.

Before executing rollback, or immediately after if the incident is time-critical, record the decision in `INCIDENT_RESPONSE.md` section 4 with UTC timestamp, trigger/gate ID, operator, reason, and verification result.

---

## 2) API Rollback (< 5 min target)

### Step A: Detect (T+0 to T+2)

```bash
curl -s https://{app-domain}/api/health
curl -s https://{app-domain}/api/ready
```

If non-200/unhealthy, continue.

### Step B: Identify last stable deploy (T+2 to T+3)

- Railway dashboard -> Service -> Deployments.
- Select latest successful deployment before incident.

### Step C: Roll back (T+3 to T+5)

Preferred:
- Click `Redeploy` on the last stable deployment.

Fallback:
- Revert broken commit in git and push to trigger deploy.

### Step D: Verify (T+5 onward)

```bash
curl -s https://{app-domain}/api/health
curl -s https://{app-domain}/api/ready
```

Then re-check critical gates:
- `GATE-AUTH-01`
- `GATE-PAY-01`
- `GATE-DB-01`

---

## 3) Database Rollback (< 30 min target)

Use only when API rollback is insufficient.

### Step A: Confirm schema/data incident (T+0 to T+3)

Signals:
- Missing column/table errors.
- Persistent migration mismatch.
- Query failures tied to schema changes.

### Step B: Pause write traffic (T+3 to T+5)

- Pause app/service via Railway to prevent new writes against broken schema.

### Step C: Restore from backup (T+5 onward)

- Request point-in-time restore from Railway support.
- Provide:
  - project/environment
  - estimated good timestamp
  - observed error signature

### Step D: Resume + verify (post-restore)

```bash
curl -s https://{app-domain}/api/health
```

Run:
- one auth smoke check
- one payment smoke check
- one campaign read/write sanity check

---

## 4) Worker Rollback (< 10 min target)

### Step A: Isolate worker issue

Look for persistent job failures in logs/Sentry for:
- publish workers
- queue processing loop

### Step B: Pause workers

Set worker skip toggle/env if available (for example `SKIP_WORKERS=true`) and restart service.

### Step C: Roll back application code

Execute API rollback section.

### Step D: Resume workers

Unset skip toggle and verify job execution recovers.

---

## 5) Post-Rollback Verification Checklist

- [ ] `/api/health` is healthy
- [ ] `/api/ready` is healthy
- [ ] Error rate trend is down in monitoring
- [ ] Auth smoke check passes
- [ ] Payment smoke check passes
- [ ] At least 5 release gates re-validated

---

## 6) Rollback SLA Targets

| Scenario | SLA |
|---|---|
| API rollback | < 5 min |
| Worker rollback | < 10 min |
| Database rollback | < 30 min |
| Multi-failure stabilization | < 30 min |
