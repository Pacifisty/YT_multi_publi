import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { paymentLogger } from '../src/common/payment-logger';

describe('PaymentLogger', () => {
  let logs: string[] = [];
  const originalLog = console.log;

  beforeEach(() => {
    logs = [];
    console.log = (message: string) => {
      logs.push(message);
    };
  });

  afterEach(() => {
    console.log = originalLog;
  });

  it('Test 1: Logs checkout creation with required fields', () => {
    paymentLogger.logCheckoutCreated('pay_123', 'user@example.com', 'PREMIUM', 99.90);

    expect(logs.length).toBe(1);
    const entry = JSON.parse(logs[0]);
    expect(entry.intentId).toBe('pay_123');
    expect(entry.email).toBe('user@example.com');
    expect(entry.status).toBe('pending');
    expect(entry.scope).toBe('checkout');
    expect(entry.timestamp).toBeDefined();
    expect(entry.context.amountBrl).toBe(99.90);
  });

  it('Test 2: Logs webhook received with provider', () => {
    paymentLogger.logWebhookReceived('pay_456', 'mercadopago', 512);

    expect(logs.length).toBe(1);
    const entry = JSON.parse(logs[0]);
    expect(entry.scope).toBe('webhook_received');
    expect(entry.provider).toBe('mercadopago');
    expect(entry.intentId).toBe('pay_456');
    expect(entry.context.rawBodySize).toBe(512);
  });

  it('Test 3: Logs status update with old and new status', () => {
    paymentLogger.logStatusUpdated('pay_789', 'pending', 'paid', 'mercadopago');

    expect(logs.length).toBe(1);
    const entry = JSON.parse(logs[0]);
    expect(entry.oldStatus).toBe('pending');
    expect(entry.newStatus).toBe('paid');
    expect(entry.provider).toBe('mercadopago');
  });

  it('Test 4: Logs error with context', () => {
    const error = new Error('API timeout');
    paymentLogger.logError('pay_error', 'payment_fetch', error, { attemptCount: 3 });

    expect(logs.length).toBe(1);
    const entry = JSON.parse(logs[0]);
    expect(entry.scope).toContain('error:payment_fetch');
    expect(entry.errorMessage).toBe('API timeout');
    expect(entry.context.attemptCount).toBe(3);
  });

  it('Test 5: Redacts secrets in context', () => {
    paymentLogger.logError('pay_secret', 'webhook_signature', 'Invalid signature', {
      accessToken: 'secret_token_12345',
      webhookSecret: 'webhook_secret_abc',
      normalField: 'visible',
    });

    expect(logs.length).toBe(1);
    const entry = JSON.parse(logs[0]);
    expect(entry.context.accessToken).toBe('[REDACTED]');
    expect(entry.context.webhookSecret).toBe('[REDACTED]');
    expect(entry.context.normalField).toBe('visible');
  });

  it('Logs are valid JSON and searchable', () => {
    paymentLogger.logCheckoutCreated('pay_search_test', 'search@example.com', 'BASIC', 49.90);
    paymentLogger.logWebhookReceived('pay_search_test', 'mercadopago', 256);

    expect(logs.length).toBe(2);

    // Verify all logs are valid JSON
    logs.forEach((log) => {
      expect(() => JSON.parse(log)).not.toThrow();
    });

    // Simulate grep + jq search by intentId
    const relevantLogs = logs.filter((log) => JSON.parse(log).intentId === 'pay_search_test');
    expect(relevantLogs.length).toBe(2);
    expect(JSON.parse(relevantLogs[0]).scope).toBe('checkout');
    expect(JSON.parse(relevantLogs[1]).scope).toBe('webhook_received');
  });
});
