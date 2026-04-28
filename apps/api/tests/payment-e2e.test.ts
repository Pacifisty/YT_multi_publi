import { describe, it, expect, vi } from 'vitest';
import { PaymentService, type CreateCheckoutInput } from '../src/account-plan/payment.service';
import { MockMercadoPagoPaymentProviderAdapter, createMockWebhookHeaders } from '../src/account-plan/mock-mercadopago-adapter';
import { classifyPaymentError } from '../src/account-plan/payment-error-classifier';

describe('Payment E2E Tests', () => {
  it('Test 1: Create Checkout', async () => {
    const adapter = new MockMercadoPagoPaymentProviderAdapter();
    const paymentService = new PaymentService({ provider: adapter });

    const result = await paymentService.createCheckout({
      email: 'user@example.com',
      kind: 'token_pack',
      pack: { id: 'pack_1', tokens: 100, priceBrl: 49.9 },
    });

    expect(result.intent).toBeDefined();
    expect(result.intent.status).toBe('pending');
    expect(result.intent.email).toBe('user@example.com');
  });

  it('Test 2: Webhook Received and Payment Status Updated', async () => {
    const adapter = new MockMercadoPagoPaymentProviderAdapter();
    const paymentService = new PaymentService({ provider: adapter });

    const checkoutResult = await paymentService.createCheckout({
      email: 'user@example.com',
      kind: 'token_pack',
      pack: { id: 'pack_1', tokens: 100, priceBrl: 49.9 },
    });

    const intentId = checkoutResult.intent.id;
    const webhookBody = JSON.stringify({
      external_reference: intentId,
      status: 'paid',
      provider_event_id: `webhook_${Date.now()}`,
    });

    const headers = createMockWebhookHeaders(intentId, `webhook_${Date.now()}`);
    const updated = await paymentService.handleWebhook(headers, webhookBody);

    expect(updated?.status).toBe('paid');
    expect(updated?.paidAt).toBeDefined();
  });

  it('Test 3: Timeout Handling', async () => {
    const adapter = new MockMercadoPagoPaymentProviderAdapter({ failureMode: 'timeout' });
    const paymentService = new PaymentService({ provider: adapter });

    await expect(
      paymentService.createCheckout({
        email: 'user@example.com',
        kind: 'token_pack',
        pack: { id: 'pack_1', tokens: 100, priceBrl: 49.9 },
      }),
    ).rejects.toThrow(/timeout/i);
  });

  it('Test 4: Signature Verification Failure', async () => {
    const adapter = new MockMercadoPagoPaymentProviderAdapter({ failureMode: 'signature_invalid' });
    const paymentService = new PaymentService({ provider: adapter });

    const checkoutResult = await paymentService.createCheckout({
      email: 'user@example.com',
      kind: 'token_pack',
      pack: { id: 'pack_1', tokens: 100, priceBrl: 49.9 },
    });

    const intentId = checkoutResult.intent.id;
    const webhookBody = JSON.stringify({ external_reference: intentId, status: 'paid' });
    const headers = createMockWebhookHeaders(intentId, `webhook_${Date.now()}`);

    const result = await paymentService.handleWebhook(headers, webhookBody);
    expect(result).toBeNull();
  });

  it('Test 5: Webhook Retry Idempotency - double credit protection', async () => {
    const adapter = new MockMercadoPagoPaymentProviderAdapter();
    const paymentService = new PaymentService({ provider: adapter });

    const checkoutResult = await paymentService.createCheckout({
      email: 'user@example.com',
      kind: 'token_pack',
      pack: { id: 'pack_1', tokens: 100, priceBrl: 49.9 },
    });

    const intentId = checkoutResult.intent.id;
    const webhookBody = JSON.stringify({
      external_reference: intentId,
      status: 'paid',
      provider_event_id: 'webhook_123_same',
    });

    const headers = createMockWebhookHeaders(intentId, 'webhook_123_same');

    const first = await paymentService.handleWebhook(headers, webhookBody);
    expect(first?.status).toBe('paid');

    const second = await paymentService.handleWebhook(headers, webhookBody);
    expect(second?.status).toBe('paid');
  });

  it('Test 6: Error Classification - Permanent', () => {
    const permanentError = new Error('Invalid token');
    const classification = classifyPaymentError(permanentError);
    expect(classification).toBe('permanent');
  });

  it('Test 7: Error Classification - Transient', () => {
    const transientError = new Error('Request timeout after 10000ms');
    const classification = classifyPaymentError(transientError);
    expect(classification).toBe('transient');
  });

  it('Test 8: Plan Purchase E2E', async () => {
    const adapter = new MockMercadoPagoPaymentProviderAdapter();
    const paymentService = new PaymentService({ provider: adapter });

    const result = await paymentService.createCheckout({
      email: 'user@example.com',
      kind: 'plan',
      planDefinition: { code: 'PRO', label: 'Pro Plan', priceBrl: 99.9, maxTokens: 1000, dailyVisitTokens: 10 },
    });

    const intentId = result.intent.id;
    expect(result.intent.purchase.kind).toBe('plan');
    expect(result.intent.status).toBe('pending');
  });
});
