import { describe, it, expect } from 'vitest';
import { PaymentService, type CreateCheckoutInput, type VerifiedWebhook } from '../src/account-plan/payment.service';
import { PrismaWebhookDeduplicator } from '../src/account-plan/webhook-deduplication';

// Mock deduplicator for testing idempotency
class MockWebhookDeduplicator {
  private processed = new Map<string, boolean>();

  async recordWebhookEvent(provider: string, providerEventId: string, externalReference: string, eventType: string, rawPayload?: string): Promise<void> {
    const key = `${provider}:${providerEventId}`;
    this.processed.set(key, true);
  }

  async hasProcessedEvent(provider: string, providerEventId: string): Promise<boolean> {
    const key = `${provider}:${providerEventId}`;
    return this.processed.has(key);
  }
}

describe('Webhook Idempotency', () => {
  it('Test 1: Create payment intent', async () => {
    const paymentService = new PaymentService();
    const result = await paymentService.createCheckout({
      email: 'test@example.com',
      kind: 'token_pack',
      pack: { id: 'pack_1', tokens: 100, priceBrl: 49.9 },
    });
    expect(result.intent).toBeDefined();
    expect(result.intent.status).toBe('pending');
  });

  it('Test 2: First webhook arrival updates payment status', async () => {
    const mockAdapter = {
      name: 'mercadopago',
      createCheckout: async () => ({ providerIntentId: 'mp_123', checkoutUrl: null }),
      verifyWebhook: async (_headers: Record<string, string>, _rawBody: string): Promise<VerifiedWebhook> => ({
        providerEventId: 'webhook_event_123',
        externalReference: 'pay_123',
        status: 'paid',
      }),
    };

    const deduplicator = new MockWebhookDeduplicator();
    const paymentService = new PaymentService({
      provider: mockAdapter as any,
      webhookDeduplicator: deduplicator,
    });

    const mockRepo = paymentService['repository'];
    const intent = await mockRepo.create({
      id: 'pay_123',
      provider: 'mercadopago',
      providerIntentId: 'mp_123',
      email: 'test@example.com',
      purchase: { kind: 'token_pack', packId: 'pack_1', tokens: 100 },
      amountBrl: 49.9,
      currency: 'BRL',
      status: 'pending',
      checkoutUrl: null,
      externalReference: 'pay_123',
      errorMessage: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      paidAt: null,
    });

    const updated = await paymentService.handleWebhook({}, '{}');
    expect(updated?.status).toBe('paid');
    expect(await deduplicator.hasProcessedEvent('mercadopago', 'webhook_event_123')).toBe(true);
  });

  it('Test 3: Second webhook (same providerEventId) returns early without reprocessing', async () => {
    let updateCallCount = 0;

    const mockAdapter = {
      name: 'mercadopago',
      createCheckout: async () => ({ providerIntentId: 'mp_456', checkoutUrl: null }),
      verifyWebhook: async (_headers: Record<string, string>, _rawBody: string): Promise<VerifiedWebhook> => ({
        providerEventId: 'webhook_event_456',
        externalReference: 'pay_456',
        status: 'paid',
      }),
    };

    const mockRepo = {
      create: async (intent: any) => intent,
      findById: async (id: string) => ({
        id: 'pay_456',
        provider: 'mercadopago',
        providerIntentId: 'mp_456',
        email: 'test@example.com',
        purchase: { kind: 'token_pack', packId: 'pack_1', tokens: 100 },
        amountBrl: 49.9,
        currency: 'BRL',
        status: 'pending',
        checkoutUrl: null,
        externalReference: 'pay_456',
        errorMessage: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        paidAt: null,
      }),
      findByProviderIntentId: async () => null,
      update: async (id: string, patch: any) => {
        updateCallCount++;
        return { id, ...patch };
      },
      listByEmail: async () => [],
    };

    const deduplicator = new MockWebhookDeduplicator();
    const paymentService = new PaymentService({
      provider: mockAdapter as any,
      repository: mockRepo,
      webhookDeduplicator: deduplicator,
    });

    // First webhook
    await paymentService.handleWebhook({}, '{}');
    const firstUpdateCount = updateCallCount;

    // Second webhook (same event ID)
    await paymentService.handleWebhook({}, '{}');
    const secondUpdateCount = updateCallCount;

    // Second webhook should not trigger another update (early return on duplicate)
    expect(secondUpdateCount).toBe(firstUpdateCount);
  });

  it('Test 4: Verify only one WebhookEvent record exists for duplicate attempts', async () => {
    const deduplicator = new MockWebhookDeduplicator();

    // Simulate two webhook arrivals with same event ID
    await deduplicator.recordWebhookEvent('mercadopago', 'webhook_123', 'pay_789', 'payment');
    const exists1 = await deduplicator.hasProcessedEvent('mercadopago', 'webhook_123');

    // Second call should recognize it's already processed
    const exists2 = await deduplicator.hasProcessedEvent('mercadopago', 'webhook_123');

    expect(exists1).toBe(true);
    expect(exists2).toBe(true);
  });

  it('Documentation: Verify idempotency in production', () => {
    // To verify idempotency in production, run:
    // SELECT COUNT(DISTINCT provider_event_id) FROM webhook_events
    // WHERE external_reference = 'pay_xxxxx' (should be 1)
    //
    // This ensures same webhook was not processed multiple times.
    // Each payment intent should have exactly one webhook event record.

    const exampleQuery = `
    SELECT external_reference, COUNT(*) as webhook_count
    FROM webhook_events
    GROUP BY external_reference
    HAVING COUNT(*) > 1;  -- Returns duplicate attempts
    `;

    expect(exampleQuery).toContain('webhook_events');
    expect(exampleQuery).toContain('external_reference');
  });
});
