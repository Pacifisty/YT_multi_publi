import type { PaymentProviderAdapter, PaymentStatus, ProviderCheckoutInput, VerifiedWebhook } from './payment.service';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface MockAdapterOptions {
  delayMs?: number;
  failureMode?: 'success' | 'timeout' | 'signature_invalid';
}

export class MockMercadoPagoPaymentProviderAdapter implements PaymentProviderAdapter {
  readonly name = 'mercadopago';
  private delayMs: number;
  private failureMode: 'success' | 'timeout' | 'signature_invalid';

  constructor(options: MockAdapterOptions = {}) {
    this.delayMs = options.delayMs ?? 0;
    this.failureMode = options.failureMode ?? 'success';
  }

  async createCheckout(input: ProviderCheckoutInput): Promise<{ providerIntentId: string; checkoutUrl: string | null }> {
    if (this.delayMs > 0) {
      await delay(this.delayMs);
    }

    if (this.failureMode === 'timeout') {
      throw new Error('Request timeout after 10000ms');
    }

    const providerIntentId = `mock_mpago_${Math.random().toString(36).slice(2, 12)}`;
    return {
      providerIntentId,
      checkoutUrl: null,
    };
  }

  async verifyWebhook(_headers: Record<string, string>, rawBody: string): Promise<VerifiedWebhook | null> {
    if (this.failureMode === 'signature_invalid') {
      return null;
    }

    try {
      const parsed = JSON.parse(rawBody);
      const externalReference = parsed.external_reference || parsed.externalReference;
      const status = (parsed.status || 'pending') as PaymentStatus;

      return {
        providerEventId: parsed.provider_event_id || `webhook_${Math.random().toString(36).slice(2, 12)}`,
        externalReference,
        status,
      };
    } catch {
      return null;
    }
  }
}

export function createMockWebhookHeaders(dataId: string, requestId: string): Record<string, string> {
  return {
    'x-request-id': requestId,
    'x-signature': 'mock-signature',
    'content-type': 'application/json',
  };
}
