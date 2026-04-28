import { createHmac, timingSafeEqual } from 'node:crypto';
import { MercadoPagoConfig, Preference, Payment } from 'mercadopago';
import type {
  PaymentProvider,
  PaymentProviderAdapter,
  PaymentStatus,
  ProviderCheckoutInput,
  VerifiedWebhook,
} from './payment.service';
import { paymentLogger } from '../common/payment-logger';

export interface MercadoPagoPaymentAdapterOptions {
  accessToken: string;
  webhookSecret?: string;
  timeoutMs?: number;
}

export class MercadoPagoPaymentProviderAdapter implements PaymentProviderAdapter {
  readonly name: PaymentProvider = 'mercadopago';
  private readonly config: MercadoPagoConfig;
  private readonly webhookSecret: string | undefined;
  private readonly timeoutMs: number;

  constructor(options: MercadoPagoPaymentAdapterOptions) {
    if (!options.accessToken) {
      throw new Error('MercadoPagoPaymentProviderAdapter requires an accessToken.');
    }
    this.config = new MercadoPagoConfig({ accessToken: options.accessToken });
    this.webhookSecret = options.webhookSecret;
    this.timeoutMs = options.timeoutMs ?? 10000;
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error(`Request timeout after ${this.timeoutMs}ms`)), this.timeoutMs),
      ),
    ]);
  }

  async createCheckout(input: ProviderCheckoutInput): Promise<{ providerIntentId: string; checkoutUrl: string | null }> {
    const preference = new Preference(this.config);
    const item = describeItem(input);
    const result = await this.withTimeout(preference.create({
      body: {
        items: [
          {
            id: item.id,
            title: item.title,
            quantity: 1,
            unit_price: input.amountBrl,
            currency_id: 'BRL',
          },
        ],
        payer: { email: input.email },
        back_urls: {
          success: input.successUrl || 'http://localhost:3000',
          failure: input.cancelUrl || 'http://localhost:3000',
          pending: input.successUrl || 'http://localhost:3000',
        },
        auto_return: 'approved',
        notification_url: input.notificationUrl,
        external_reference: input.externalReference,
        statement_descriptor: 'YTMULTIPUBLI',
      },
    }));

    const id = result.id;
    if (!id) {
      throw new Error('MercadoPago did not return a preference id.');
    }

    return {
      providerIntentId: id,
      checkoutUrl: result.init_point ?? result.sandbox_init_point ?? null,
    };
  }

  async verifyWebhook(headers: Record<string, string>, rawBody: string): Promise<VerifiedWebhook | null> {
    const normalized = normalizeHeaders(headers);
    const parsed = safeJsonParse(rawBody);
    if (!parsed || typeof parsed !== 'object') return null;

    const type = (parsed as { type?: string; topic?: string }).type ?? (parsed as { topic?: string }).topic;
    const dataId = (parsed as { data?: { id?: string | number } }).data?.id;
    if (!dataId) return null;
    const dataIdString = String(dataId);

    if (type !== 'payment') {
      // merchant_order events also arrive; we only act on payment.
      return null;
    }

    const requestId = normalized['x-request-id'] ?? '';
    if (this.webhookSecret) {
      const signatureHeader = normalized['x-signature'] ?? '';
      if (!verifyMercadoPagoSignature(signatureHeader, this.webhookSecret, dataIdString, requestId)) {
        paymentLogger.logError(dataIdString || 'unknown', 'webhook_signature', 'Invalid or missing signature');
        return null;
      }
    }

    const payment = new Payment(this.config);
    const result = await this.withTimeout(payment.get({ id: dataIdString }));
    if (!result) {
      paymentLogger.logError(dataIdString, 'payment_fetch', 'MercadoPago API returned null');
      return null;
    }

    // Note: PaymentResponse doesn't expose preference_id in the SDK types,
    // so we rely on external_reference (set by us at preference creation).
    // Webhook event is identified by x-request-id header for deduplication
    return {
      providerEventId: requestId,
      externalReference: result.external_reference ?? undefined,
      status: mapMercadoPagoStatus(result.status ?? 'pending'),
    };
  }
}

function describeItem(input: ProviderCheckoutInput): { id: string; title: string } {
  if (input.purchase.kind === 'plan') {
    return { id: `plan_${input.purchase.planCode.toLowerCase()}`, title: `Plano ${input.purchase.planCode}` };
  }
  return { id: input.purchase.packId, title: `${input.purchase.tokens} tokens avulsos` };
}

function normalizeHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k.toLowerCase()] = String(v);
  }
  return out;
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function verifyMercadoPagoSignature(
  signatureHeader: string,
  secret: string,
  dataId: string,
  requestId: string,
): boolean {
  const parts = signatureHeader.split(',').map((p) => p.trim());
  let ts: string | undefined;
  let v1: string | undefined;
  for (const part of parts) {
    const [k, v] = part.split('=');
    if (k === 'ts') ts = v;
    else if (k === 'v1') v1 = v;
  }
  if (!ts || !v1) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const expected = createHmac('sha256', secret).update(manifest).digest('hex');

  const expectedBuf = Buffer.from(expected, 'hex');
  const receivedBuf = Buffer.from(v1, 'hex');
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}

function mapMercadoPagoStatus(status: string): PaymentStatus {
  switch (status) {
    case 'approved':
      return 'paid';
    case 'pending':
    case 'in_process':
    case 'in_mediation':
    case 'authorized':
      return 'processing';
    case 'rejected':
      return 'failed';
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
    case 'charged_back':
      return 'refunded';
    default:
      return 'pending';
  }
}
