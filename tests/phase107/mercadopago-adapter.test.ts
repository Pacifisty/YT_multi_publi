import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const preferenceCreate = vi.fn();
const paymentGet = vi.fn();

vi.mock('mercadopago', () => {
  function MercadoPagoConfig(this: any, opts: any) {
    this.accessToken = opts?.accessToken;
  }
  function Preference(this: any) {
    this.create = preferenceCreate;
  }
  function Payment(this: any) {
    this.get = paymentGet;
  }
  return { MercadoPagoConfig, Preference, Payment };
});

import { MercadoPagoPaymentProviderAdapter } from '../../apps/api/src/account-plan/mercadopago-payment.adapter';

beforeEach(() => {
  preferenceCreate.mockReset();
  paymentGet.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('MercadoPagoPaymentProviderAdapter — constructor', () => {
  test('throws when accessToken is missing', () => {
    expect(() => new MercadoPagoPaymentProviderAdapter({ accessToken: '' })).toThrow();
  });

  test('reports its provider name as "mercadopago"', () => {
    const adapter = new MercadoPagoPaymentProviderAdapter({ accessToken: 'TEST-x' });
    expect(adapter.name).toBe('mercadopago');
  });
});

describe('MercadoPagoPaymentProviderAdapter — createCheckout (plan)', () => {
  test('builds a Preference with plan title, BRL price and external_reference', async () => {
    preferenceCreate.mockResolvedValue({ id: 'pref_123', init_point: 'https://mp/checkout/pref_123' });
    const adapter = new MercadoPagoPaymentProviderAdapter({ accessToken: 'TEST-x' });

    const result = await adapter.createCheckout({
      email: 'buyer@test.com',
      purchase: { kind: 'plan', planCode: 'PRO' },
      amountBrl: 49.9,
      externalReference: 'pay_abc',
      notificationUrl: 'https://app.test/api/account/payments/webhook',
      successUrl: 'https://app.test/ok',
      cancelUrl: 'https://app.test/cancel',
    });

    expect(result).toEqual({ providerIntentId: 'pref_123', checkoutUrl: 'https://mp/checkout/pref_123' });
    expect(preferenceCreate).toHaveBeenCalledTimes(1);

    const calledWith = preferenceCreate.mock.calls[0][0].body;
    expect(calledWith.items[0]).toMatchObject({
      title: expect.stringContaining('PRO'),
      quantity: 1,
      unit_price: 49.9,
      currency_id: 'BRL',
    });
    expect(calledWith.payer.email).toBe('buyer@test.com');
    expect(calledWith.external_reference).toBe('pay_abc');
    expect(calledWith.notification_url).toBe('https://app.test/api/account/payments/webhook');
    expect(calledWith.back_urls.success).toBe('https://app.test/ok');
  });

  test('falls back to sandbox_init_point when init_point is missing', async () => {
    preferenceCreate.mockResolvedValue({ id: 'pref_x', sandbox_init_point: 'https://sb/x' });
    const adapter = new MercadoPagoPaymentProviderAdapter({ accessToken: 'TEST-x' });
    const result = await adapter.createCheckout({
      email: 'b@t.com', purchase: { kind: 'plan', planCode: 'BASIC' },
      amountBrl: 19.9, externalReference: 'p1',
    });
    expect(result.checkoutUrl).toBe('https://sb/x');
  });

  test('throws when MP returns no preference id', async () => {
    preferenceCreate.mockResolvedValue({ init_point: 'https://x' });
    const adapter = new MercadoPagoPaymentProviderAdapter({ accessToken: 'TEST-x' });
    await expect(
      adapter.createCheckout({
        email: 'b@t.com', purchase: { kind: 'plan', planCode: 'BASIC' },
        amountBrl: 19.9, externalReference: 'p1',
      }),
    ).rejects.toThrow();
  });
});

describe('MercadoPagoPaymentProviderAdapter — createCheckout (token_pack)', () => {
  test('builds a Preference with pack title and pack id', async () => {
    preferenceCreate.mockResolvedValue({ id: 'pref_pack', init_point: 'https://mp/pack' });
    const adapter = new MercadoPagoPaymentProviderAdapter({ accessToken: 'TEST-x' });

    await adapter.createCheckout({
      email: 'b@t.com',
      purchase: { kind: 'token_pack', packId: 'pack_medium', tokens: 300 },
      amountBrl: 24.9,
      externalReference: 'pay_xyz',
    });

    const body = preferenceCreate.mock.calls[0][0].body;
    expect(body.items[0]).toMatchObject({
      id: 'pack_medium',
      title: expect.stringContaining('300 tokens'),
      unit_price: 24.9,
    });
    expect(body.external_reference).toBe('pay_xyz');
  });
});

describe('MercadoPagoPaymentProviderAdapter — verifyWebhook', () => {
  test('returns null for non-payment topics (e.g. merchant_order)', async () => {
    const adapter = new MercadoPagoPaymentProviderAdapter({ accessToken: 'TEST-x' });
    const result = await adapter.verifyWebhook!({}, JSON.stringify({ type: 'merchant_order', data: { id: '1' } }));
    expect(result).toBeNull();
    expect(paymentGet).not.toHaveBeenCalled();
  });

  test('returns null for malformed JSON body', async () => {
    const adapter = new MercadoPagoPaymentProviderAdapter({ accessToken: 'TEST-x' });
    const result = await adapter.verifyWebhook!({}, 'not-json');
    expect(result).toBeNull();
  });

  test('returns null when data.id is missing', async () => {
    const adapter = new MercadoPagoPaymentProviderAdapter({ accessToken: 'TEST-x' });
    const result = await adapter.verifyWebhook!({}, JSON.stringify({ type: 'payment', data: {} }));
    expect(result).toBeNull();
  });

  test('rejects payment event with invalid x-signature when secret is set', async () => {
    const adapter = new MercadoPagoPaymentProviderAdapter({ accessToken: 'TEST-x', webhookSecret: 'secret123' });
    const body = JSON.stringify({ type: 'payment', data: { id: '999' } });
    const headers = { 'x-signature': 'ts=1700000000,v1=deadbeef', 'x-request-id': 'req-1' };
    const result = await adapter.verifyWebhook!(headers, body);
    expect(result).toBeNull();
    expect(paymentGet).not.toHaveBeenCalled();
  });

  test('accepts payment event with valid x-signature and maps approved → paid', async () => {
    const secret = 'secret123';
    const dataId = '999';
    const requestId = 'req-1';
    const ts = '1700000000';
    const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const v1 = createHmac('sha256', secret).update(manifest).digest('hex');

    paymentGet.mockResolvedValue({
      status: 'approved',
      preference_id: 'pref_999',
      external_reference: 'pay_abc',
    });

    const adapter = new MercadoPagoPaymentProviderAdapter({ accessToken: 'TEST-x', webhookSecret: secret });
    const result = await adapter.verifyWebhook!(
      { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId },
      JSON.stringify({ type: 'payment', data: { id: dataId } }),
    );

    expect(result).toEqual({
      externalReference: 'pay_abc',
      status: 'paid',
    });
  });

  test('skips signature verification when no secret is configured', async () => {
    paymentGet.mockResolvedValue({ status: 'approved', external_reference: 'pay_x' });
    const adapter = new MercadoPagoPaymentProviderAdapter({ accessToken: 'TEST-x' });
    const result = await adapter.verifyWebhook!({}, JSON.stringify({ type: 'payment', data: { id: '1' } }));
    expect(result?.status).toBe('paid');
  });

  test.each([
    ['approved', 'paid'],
    ['pending', 'processing'],
    ['in_process', 'processing'],
    ['in_mediation', 'processing'],
    ['authorized', 'processing'],
    ['rejected', 'failed'],
    ['cancelled', 'cancelled'],
    ['refunded', 'refunded'],
    ['charged_back', 'refunded'],
    ['unknown_future_status', 'pending'],
  ])('maps MP status "%s" -> %s', async (mpStatus, expected) => {
    paymentGet.mockResolvedValue({ status: mpStatus, external_reference: 'pay_x' });
    const adapter = new MercadoPagoPaymentProviderAdapter({ accessToken: 'TEST-x' });
    const result = await adapter.verifyWebhook!({}, JSON.stringify({ type: 'payment', data: { id: '1' } }));
    expect(result?.status).toBe(expected);
  });
});
