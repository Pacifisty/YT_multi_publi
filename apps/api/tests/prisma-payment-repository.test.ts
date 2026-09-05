import { describe, expect, it } from 'vitest';
import { PrismaPaymentRepository } from '../src/account-plan/prisma-payment.repository';
import type { PaymentIntent } from '../src/account-plan/payment.service';

function createIntent(): PaymentIntent {
  const now = new Date('2026-09-04T12:00:00.000Z').toISOString();
  return {
    id: 'pay_123',
    provider: 'mercadopago',
    providerIntentId: null,
    email: 'buyer@example.test',
    purchase: { kind: 'token_pack', packId: 'pack_100', tokens: 100 },
    amountBrl: 49.9,
    currency: 'BRL',
    status: 'pending',
    checkoutUrl: null,
    externalReference: 'pay_123',
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    paidAt: null,
  };
}

describe('PrismaPaymentRepository', () => {
  it('maps decimal amounts and timestamps without changing BRL units', async () => {
    let stored: any;
    const delegate = {
      create: async ({ data }: any) => (stored = data),
      findUnique: async ({ where }: any) => where.id === stored?.id ? stored : null,
      update: async ({ data }: any) => (stored = { ...stored, ...data }),
      updateMany: async ({ data }: any) => {
        stored = { ...stored, ...data };
        return { count: 1 };
      },
      findMany: async () => stored ? [stored] : [],
    };
    const repository = new PrismaPaymentRepository({ paymentIntentRecord: delegate });

    const created = await repository.create(createIntent());
    expect(created.amountBrl).toBe(49.9);

    const paid = await repository.update('pay_123', {
      status: 'paid',
      paidAt: '2026-09-04T12:01:00.000Z',
    });
    expect(paid?.status).toBe('paid');
    expect(paid?.paidAt).toBe('2026-09-04T12:01:00.000Z');
  });

  it('does not return an intent that belongs to another provider', async () => {
    const row = {
      ...createIntent(),
      amountBrl: { toString: () => '49.90' },
      createdAt: new Date('2026-09-04T12:00:00.000Z'),
      updatedAt: new Date('2026-09-04T12:00:00.000Z'),
    };
    const repository = new PrismaPaymentRepository({
      paymentIntentRecord: {
        create: async () => row,
        findUnique: async () => row,
        update: async () => row,
        updateMany: async () => ({ count: 0 }),
        findMany: async () => [row],
      },
    });

    await expect(repository.findByProviderIntentId('stripe', 'mp_123')).resolves.toBeNull();
  });
});
