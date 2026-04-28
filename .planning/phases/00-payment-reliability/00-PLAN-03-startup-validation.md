---
wave: 1
depends_on: []
files_modified:
  - apps/api/src/startup/payment-startup-validator.ts
  - apps/api/src/app.ts
autonomous: false
---

# PLAN 03: Startup Validation (Wave 1)

**Status:** Ready for execution
**Effort:** 0.5 day
**Risk:** Very Low — pure validation at boot, no runtime behavior change

## Requirements Addressed

- **PAY-03:** Startup validation — App fails at boot if env vars missing

## Objective

Implement startup validation that checks required payment environment variables and fails the app with a clear error message if MERCADOPAGO_ACCESS_TOKEN or other critical config is missing in production.

## Must-Haves

1. ✓ App exits with error code 1 if MERCADOPAGO_ACCESS_TOKEN missing in production
2. ✓ App logs clear error message naming which env vars are missing
3. ✓ In development/test, missing token triggers warning (allows mock adapter)
4. ✓ Validation occurs before PaymentService instantiation
5. ✓ Startup validator is injectable and testable

## Tasks

### Task 1: Create Payment Startup Validator Utility

**Name:** Build `payment-startup-validator.ts` with validation logic

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/.env.example` (line 27-40, payment env vars)
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/app.ts` (line 66-90, app initialization)

**Action:**
1. Create new file: `apps/api/src/startup/payment-startup-validator.ts`
2. Export function `validatePaymentConfig(env: Record<string, string | undefined>, nodeEnv: string): void`
3. Implement validation:
   - If `nodeEnv === 'production'`:
     - Require `MERCADOPAGO_ACCESS_TOKEN` to be set and non-empty
     - If missing: throw Error with message: `"[startup] MERCADOPAGO_ACCESS_TOKEN is required in production. Aborting."`
     - If missing webhook secret: warn `console.warn('[startup] MERCADOPAGO_WEBHOOK_SECRET not set; webhooks cannot be verified. Recommend setting it.')`
   - If `nodeEnv === 'test'` or `development'`:
     - If missing token: warn `console.warn('[startup] MERCADOPAGO_ACCESS_TOKEN not set; using mock adapter')`
     - Continue (allow mock)
4. Validate PAYMENT_SUCCESS_URL and PAYMENT_CANCEL_URL are set:
   - Warn if missing (defaults will be used but explicit URLs are better)
5. Return validation result: `{ isValid: boolean; errors: string[]; warnings: string[] }`

**Acceptance Criteria:**
```bash
grep "validatePaymentConfig" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/startup/payment-startup-validator.ts
grep "MERCADOPAGO_ACCESS_TOKEN" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/startup/payment-startup-validator.ts
grep "production" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/startup/payment-startup-validator.ts
grep "throw Error" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/startup/payment-startup-validator.ts
```

---

### Task 2: Integrate Validator into App Startup

**Name:** Call validator in createApp before PaymentService creation

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/app.ts` (line 66-90, createApp function)
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/startup/payment-startup-validator.ts` (just created)

**Action:**
1. Import `validatePaymentConfig` at top of app.ts
2. In `createApp` function (line 66):
   - Get `env = config.env ?? process.env`
   - Get `nodeEnv = env.NODE_ENV ?? 'development'`
   - Call `validatePaymentConfig(env, nodeEnv)` before line 75 (before PaymentService creation)
   - If validation throws: let the error propagate (will crash app startup with clear message)
3. Add comment above validator call: "Validate payment config early; abort startup if critical vars missing"
4. Update createApp JSDoc to document: "May throw Error if payment config is invalid in production"

**Acceptance Criteria:**
```bash
grep "validatePaymentConfig" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/app.ts
grep "before PaymentService" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/app.ts
grep "May throw Error" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/app.ts
```

---

### Task 3: Create Startup Validation Test

**Name:** Verify app fails when MERCADOPAGO_ACCESS_TOKEN missing in production

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/startup/payment-startup-validator.ts` (just created)
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/app.ts` (createApp function)

**Action:**
1. Create test file: `apps/api/tests/startup-validation.test.ts`
2. Test 1 - Production without token:
   - Call `validatePaymentConfig({}, 'production')`
   - Expect to throw Error
   - Verify error message contains "MERCADOPAGO_ACCESS_TOKEN" and "production"
3. Test 2 - Production with token:
   - Call `validatePaymentConfig({ MERCADOPAGO_ACCESS_TOKEN: 'test-token' }, 'production')`
   - Expect no error
4. Test 3 - Development without token:
   - Call `validatePaymentConfig({}, 'development')`
   - Expect no error (console.warn called)
   - Verify warning logged
5. Test 4 - Test environment without token:
   - Call `validatePaymentConfig({}, 'test')`
   - Expect no error
6. Test 5 - Production without webhook secret:
   - Call `validatePaymentConfig({ MERCADOPAGO_ACCESS_TOKEN: 'token' }, 'production')`
   - Expect warning about webhook secret
7. Test 6 - createApp integration:
   - Call `createApp({ env: { NODE_ENV: 'production' } })`
   - Expect to throw Error with "MERCADOPAGO_ACCESS_TOKEN" message

**Acceptance Criteria:**
```bash
grep "throw Error" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/startup-validation.test.ts
grep "production without token" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/startup-validation.test.ts
grep "console.warn" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/startup-validation.test.ts
npm run test -- startup-validation.test.ts 2>&1 | grep -E "pass|fail"
```

---

### Task 4: Error Message Documentation

**Name:** Document expected error message for ops/deployment teams

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/startup/payment-startup-validator.ts` (error message)

**Action:**
1. In payment-startup-validator.ts, add JSDoc comment with examples:
```
/**
 * Validates payment configuration at startup.
 * 
 * In production: Requires MERCADOPAGO_ACCESS_TOKEN.
 * 
 * Expected error message on missing token:
 *   "[startup] MERCADOPAGO_ACCESS_TOKEN is required in production. Aborting."
 * 
 * Example fix:
 *   export MERCADOPAGO_ACCESS_TOKEN=APP_USR_xxxx
 *   npm run server
 */
```
2. Add deployment guide comment in app.ts:
```
// Payment config validation: app exits with error code 1 if MERCADOPAGO_ACCESS_TOKEN
// missing in production. See payment-startup-validator.ts for fix steps.
```

**Acceptance Criteria:**
```bash
grep -A 10 "Expected error message" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/startup/payment-startup-validator.ts
grep "Aborting" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/startup/payment-startup-validator.ts
```

---

### Task 5: Verify Error Exit Code

**Name:** Ensure app exits with code 1 on validation failure

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/server.ts` (app startup entry point)

**Action:**
1. In `server.ts`, find where app is started (search for `createApp` call or `listen`)
2. Wrap in try-catch:
```typescript
try {
  const app = createApp(config);
  // ... server startup
} catch (error) {
  console.error('[startup] Fatal error:', error instanceof Error ? error.message : String(error));
  process.exit(1);  // Exit with code 1 on startup failure
}
```
3. If error is logged and uncaught, ensure process.exit(1) is called
4. Add comment: "Payment config validation errors cause startup abort with exit code 1"

**Acceptance Criteria:**
```bash
grep "process.exit" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/server.ts
grep "createApp" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/server.ts
grep "try.*catch" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/src/server.ts
```

---

### Task 6: Update .env.example with Payment Config Comments

**Name:** Add deployment notes to .env.example

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/.env.example` (line 27-40, payment section)

**Action:**
1. Update payment section comments in .env.example:
```
# Mercado Pago Checkout Pro.
# REQUIRED IN PRODUCTION: MERCADOPAGO_ACCESS_TOKEN must be set to a valid token.
# Use TEST-... for sandbox, APP_USR-... for production.
# If missing in production, app startup will fail with exit code 1.
MERCADOPAGO_ACCESS_TOKEN=
# STRONGLY RECOMMENDED: Webhook signature verification. Without this, webhooks are not verified.
MERCADOPAGO_WEBHOOK_SECRET=
```
2. Ensure comments are clear that token is required for production

**Acceptance Criteria:**
```bash
grep -i "required in production" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/.env.example
grep -i "exit code 1" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/.env.example
```

---

### Task 7: Startup Validation in Tests

**Name:** Ensure test suite can override startup validation

**Read First:**
- `/c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/startup-validation.test.ts` (test file created earlier)

**Action:**
1. In test setup, create `mockConfig` that includes MERCADOPAGO_ACCESS_TOKEN:
   - `const mockConfig = { env: { MERCADOPAGO_ACCESS_TOKEN: 'test-token', NODE_ENV: 'test' } }`
2. All integration tests that call `createApp` must pass this config
3. Add test note: "In test environment, provide MERCADOPAGO_ACCESS_TOKEN even if mock; ensures startup validation passes"
4. Create test helper `createTestApp` that applies test config defaults

**Acceptance Criteria:**
```bash
grep "mockConfig" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/startup-validation.test.ts
grep "MERCADOPAGO_ACCESS_TOKEN.*test-token" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/startup-validation.test.ts
grep "createTestApp" /c/Users/Lucas/Documents/Rep/01/YT_multi_publi_2/apps/api/tests/startup-validation.test.ts
```

---

## Verification Checklist

After all tasks complete:

1. payment-startup-validator.ts created with validatePaymentConfig function
2. Validator called in createApp before PaymentService instantiation
3. Startup validation test created and passing (6-7 test cases)
4. App exits with code 1 if MERCADOPAGO_ACCESS_TOKEN missing in production
5. Clear error message logged: "[startup] MERCADOPAGO_ACCESS_TOKEN is required in production"
6. .env.example updated with deployment notes
7. Test suite can override startup validation with mock config

---

## Success Criteria (Definition of Done)

- ✓ `npm run test -- startup-validation.test.ts` passes
- ✓ Starting app with `NODE_ENV=production` and no MERCADOPAGO_ACCESS_TOKEN causes exit code 1
- ✓ Starting app with `NODE_ENV=development` and no token logs warning (does not exit)
- ✓ Error message clearly names which env var is missing
- ✓ .env.example explains that MERCADOPAGO_ACCESS_TOKEN is required in production
- ✓ Test suite provides mock config to pass startup validation

---

## Notes

- Wave 1 of Phase 0: Payment Reliability. No deployment blockers.
- Startup validation is strict in production, lenient in dev/test.
- Fail-fast approach: better to crash at startup with clear message than to silently degrade to mock.
- Use process.exit(1) to ensure container/process manager knows startup failed.
- Deployment teams should see error message in logs and know exactly what to fix.
