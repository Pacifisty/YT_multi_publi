import { describe, expect, test } from 'vitest';
import {
  AccountPlanService,
  TOKEN_PACK_DEFINITIONS,
  ACCOUNT_PLAN_DEFINITIONS,
} from '../../apps/api/src/account-plan/account-plan.service';
import {
  PaymentService,
  type PaymentIntent,
} from '../../apps/api/src/account-plan/payment.service';

describe('AccountPlanService.creditTokens', () => {
  test('credits tokens once for a given idempotency key', async () => {
    const service = new AccountPlanService();
    const email = 'user@test.com';

    const first = await service.creditTokens(email, 100, 'intent_1');
    expect(first.credited).toBe(true);
    expect(first.grantedTokens).toBe(100);
    const balanceAfterFirst = first.account.tokens;

    const second = await service.creditTokens(email, 100, 'intent_1');
    expect(second.credited).toBe(false);
    expect(second.grantedTokens).toBe(0);
    expect(second.account.tokens).toBe(balanceAfterFirst);
  });

  test('credits tokens for distinct idempotency keys', async () => {
    const service = new AccountPlanService();
    const email = 'user@test.com';

    const first = await service.creditTokens(email, 100, 'intent_a');
    const second = await service.creditTokens(email, 50, 'intent_b');

    expect(first.credited).toBe(true);
    expect(second.credited).toBe(true);
    expect(second.account.tokens - first.account.tokens).toBe(50);
  });

  test('rejects non-positive amounts', async () => {
    const service = new AccountPlanService();
    await expect(service.creditTokens('u@test.com', 0, 'k1')).rejects.toThrow();
    await expect(service.creditTokens('u@test.com', -5, 'k2')).rejects.toThrow();
  });

  test('rejects empty idempotency key', async () => {
    const service = new AccountPlanService();
    await expect(service.creditTokens('u@test.com', 10, '')).rejects.toThrow();
  });
});

describe('PaymentService — token_pack purchase flow', () => {
  test('creates a token_pack intent with the pack tokens stored in purchase', async () => {
    const payment = new PaymentService();
    const pack = TOKEN_PACK_DEFINITIONS.pack_medium;

    const result = await payment.createCheckout({
      kind: 'token_pack',
      email: 'buyer@test.com',
      pack,
    });

    expect(result.intent.purchase.kind).toBe('token_pack');
    if (result.intent.purchase.kind === 'token_pack') {
      expect(result.intent.purchase.packId).toBe(pack.id);
      expect(result.intent.purchase.tokens).toBe(pack.tokens);
    }
    expect(result.intent.amountBrl).toBe(pack.priceBrl);
    expect(result.intent.email).toBe('buyer@test.com');
    expect(result.intent.status).toBe('pending');
  });

  test('still creates a plan intent through the existing path', async () => {
    const payment = new PaymentService();
    const definition = ACCOUNT_PLAN_DEFINITIONS.PRO;

    const result = await payment.createCheckout({
      kind: 'plan',
      email: 'buyer@test.com',
      planDefinition: definition,
    });

    expect(result.intent.purchase.kind).toBe('plan');
    if (result.intent.purchase.kind === 'plan') {
      expect(result.intent.purchase.planCode).toBe('PRO');
    }
    expect(result.intent.amountBrl).toBe(definition.priceBrl);
  });

  test('rejects token_pack with zero price', async () => {
    const payment = new PaymentService();
    await expect(
      payment.createCheckout({
        kind: 'token_pack',
        email: 'buyer@test.com',
        pack: { id: 'free_pack', label: 'Free', tokens: 10, priceBrl: 0, active: true },
      }),
    ).rejects.toThrow();
  });

  test('markStatus("paid") updates status and paidAt', async () => {
    const payment = new PaymentService();
    const pack = TOKEN_PACK_DEFINITIONS.pack_small;
    const result = await payment.createCheckout({
      kind: 'token_pack',
      email: 'buyer@test.com',
      pack,
    });

    const updated = await payment.markStatus(result.intent.id, 'paid');
    expect(updated?.status).toBe('paid');
    expect(updated?.paidAt).toBeTruthy();
  });
});

describe('Webhook crediting (controller behavior simulated via service composition)', () => {
  test('paid token_pack intent credits tokens to the account', async () => {
    const accountPlan = new AccountPlanService();
    const payment = new PaymentService();
    const pack = TOKEN_PACK_DEFINITIONS.pack_large;
    const email = 'webhook-buyer@test.com';

    const checkout = await payment.createCheckout({ kind: 'token_pack', email, pack });
    const paidIntent = (await payment.markStatus(checkout.intent.id, 'paid')) as PaymentIntent;

    expect(paidIntent.purchase.kind).toBe('token_pack');
    if (paidIntent.purchase.kind !== 'token_pack') return;

    const before = await accountPlan.getAccount(email);
    const credited = await accountPlan.creditTokens(email, paidIntent.purchase.tokens, paidIntent.id);

    expect(credited.credited).toBe(true);
    expect(credited.account.tokens).toBe(before.tokens + pack.tokens);

    // Webhook re-delivery: same intent id should not double-credit
    const replay = await accountPlan.creditTokens(email, paidIntent.purchase.tokens, paidIntent.id);
    expect(replay.credited).toBe(false);
    expect(replay.account.tokens).toBe(credited.account.tokens);
  });

  test('paid plan intent still routes via selectPlan path (no token credit collision)', async () => {
    const accountPlan = new AccountPlanService();
    const payment = new PaymentService();
    const definition = ACCOUNT_PLAN_DEFINITIONS.BASIC;
    const email = 'plan-buyer@test.com';

    const checkout = await payment.createCheckout({
      kind: 'plan',
      email,
      planDefinition: definition,
    });
    const paidIntent = (await payment.markStatus(checkout.intent.id, 'paid')) as PaymentIntent;

    expect(paidIntent.purchase.kind).toBe('plan');
    if (paidIntent.purchase.kind !== 'plan') return;

    const result = await accountPlan.selectPlan(email, paidIntent.purchase.planCode);
    expect(result.account.plan).toBe('BASIC');
    expect(result.account.maxTokens).toBe(definition.maxTokens);
  });
});
