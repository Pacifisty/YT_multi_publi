import type { AccountPlanType, AccountPlanDefinition, TokenPackDefinition } from './account-plan.service';
import { paymentLogger } from '../common/payment-logger';

export type PaymentProvider = 'stripe' | 'mercadopago' | 'mock';
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded';

export type Purchase =
  | { kind: 'plan'; planCode: AccountPlanType }
  | { kind: 'token_pack'; packId: string; tokens: number };

export interface PaymentIntent {
  id: string;
  provider: PaymentProvider;
  providerIntentId: string | null;
  email: string;
  purchase: Purchase;
  amountBrl: number;
  currency: 'BRL';
  status: PaymentStatus;
  checkoutUrl: string | null;
  externalReference: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  paidAt: string | null;
}

export type CreateCheckoutInput =
  | {
      email: string;
      kind: 'plan';
      planDefinition: AccountPlanDefinition;
      successUrl?: string;
      cancelUrl?: string;
    }
  | {
      email: string;
      kind: 'token_pack';
      pack: TokenPackDefinition;
      successUrl?: string;
      cancelUrl?: string;
    };

export interface CheckoutResult {
  intent: PaymentIntent;
  redirectUrl: string | null;
}

export interface ProviderCheckoutInput {
  email: string;
  purchase: Purchase;
  amountBrl: number;
  successUrl?: string;
  cancelUrl?: string;
  externalReference: string;
  notificationUrl?: string;
}

export interface VerifiedWebhook {
  providerIntentId?: string;
  externalReference?: string;
  status: PaymentStatus;
}

export interface PaymentProviderAdapter {
  readonly name: PaymentProvider;
  createCheckout(input: ProviderCheckoutInput): Promise<{ providerIntentId: string; checkoutUrl: string | null }>;
  verifyWebhook?(headers: Record<string, string>, rawBody: string): Promise<VerifiedWebhook | null>;
}

export interface PaymentRepository {
  create(intent: PaymentIntent): Promise<PaymentIntent> | PaymentIntent;
  findById(id: string): Promise<PaymentIntent | null> | PaymentIntent | null;
  findByProviderIntentId(provider: PaymentProvider, providerIntentId: string): Promise<PaymentIntent | null> | PaymentIntent | null;
  update(id: string, patch: Partial<PaymentIntent>): Promise<PaymentIntent | null> | PaymentIntent | null;
  listByEmail(email: string): Promise<PaymentIntent[]> | PaymentIntent[];
}

export interface PaymentServiceOptions {
  provider?: PaymentProviderAdapter;
  repository?: PaymentRepository;
  now?: () => Date;
  defaultSuccessUrl?: string;
  defaultCancelUrl?: string;
  defaultNotificationUrl?: string;
}

export class PaymentService {
  private readonly provider: PaymentProviderAdapter;
  private readonly repository: PaymentRepository;
  private readonly now: () => Date;
  private readonly defaultSuccessUrl: string | undefined;
  private readonly defaultCancelUrl: string | undefined;
  private readonly defaultNotificationUrl: string | undefined;

  constructor(options: PaymentServiceOptions = {}) {
    this.provider = options.provider ?? new MockPaymentProviderAdapter();
    this.repository = options.repository ?? new InMemoryPaymentRepository();
    this.now = options.now ?? (() => new Date());
    this.defaultSuccessUrl = options.defaultSuccessUrl;
    this.defaultCancelUrl = options.defaultCancelUrl;
    this.defaultNotificationUrl = options.defaultNotificationUrl;
  }

  async createCheckout(input: CreateCheckoutInput): Promise<CheckoutResult> {
    let purchase: Purchase;
    let amountBrl: number;

    if (input.kind === 'plan') {
      const definition = input.planDefinition;
      amountBrl = definition.priceBrl ?? 0;
      purchase = { kind: 'plan', planCode: definition.code };
    } else {
      const pack = input.pack;
      amountBrl = pack.priceBrl;
      purchase = { kind: 'token_pack', packId: pack.id, tokens: pack.tokens };
    }

    if (amountBrl <= 0) {
      throw new Error('This purchase does not require payment.');
    }

    const nowIso = this.now().toISOString();
    const id = `pay_${Math.random().toString(36).slice(2, 12)}_${Date.now()}`;
    const successUrl = input.successUrl ?? this.defaultSuccessUrl;
    const cancelUrl = input.cancelUrl ?? this.defaultCancelUrl;

    const providerResult = await this.provider.createCheckout({
      email: input.email,
      purchase,
      amountBrl,
      successUrl,
      cancelUrl,
      externalReference: id,
      notificationUrl: this.defaultNotificationUrl,
    });

    const intent: PaymentIntent = {
      id,
      provider: this.provider.name,
      providerIntentId: providerResult.providerIntentId,
      email: input.email.trim().toLowerCase(),
      purchase,
      amountBrl,
      currency: 'BRL',
      status: 'pending',
      checkoutUrl: providerResult.checkoutUrl,
      externalReference: id,
      errorMessage: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      paidAt: null,
    };

    const saved = await this.repository.create(intent);

    const purchaseId = purchase.kind === 'plan' ? purchase.planCode : purchase.packId;
    paymentLogger.logCheckoutCreated(saved.id, saved.email, purchaseId, amountBrl);

    return {
      intent: saved,
      redirectUrl: providerResult.checkoutUrl,
    };
  }

  async getIntent(id: string): Promise<PaymentIntent | null> {
    return this.repository.findById(id);
  }

  async listIntentsForEmail(email: string): Promise<PaymentIntent[]> {
    return this.repository.listByEmail(email.trim().toLowerCase());
  }

  async handleWebhook(headers: Record<string, string>, rawBody: string): Promise<PaymentIntent | null> {
    if (!this.provider.verifyWebhook) {
      return null;
    }

    const verified = await this.provider.verifyWebhook(headers, rawBody);
    if (!verified) return null;

    let intent: PaymentIntent | null = null;
    if (verified.externalReference) {
      intent = await this.repository.findById(verified.externalReference);
    }
    if (!intent && verified.providerIntentId) {
      intent = await this.repository.findByProviderIntentId(this.provider.name, verified.providerIntentId);
    }
    if (!intent) return null;

    paymentLogger.logWebhookReceived(intent.id, this.provider.name, rawBody.length);
    const oldStatus = intent.status;
    const updated = await this.repository.update(intent.id, {
      status: verified.status,
      paidAt: verified.status === 'paid' ? this.now().toISOString() : intent.paidAt,
      updatedAt: this.now().toISOString(),
    });

    if (updated) {
      paymentLogger.logStatusUpdated(updated.id, oldStatus, updated.status, this.provider.name);
    }

    return updated;
  }

  async markStatus(id: string, status: PaymentStatus, errorMessage?: string): Promise<PaymentIntent | null> {
    const intent = await this.repository.findById(id);
    if (!intent) return null;

    const updated = await this.repository.update(id, {
      status,
      errorMessage: errorMessage ?? null,
      paidAt: status === 'paid' ? this.now().toISOString() : null,
      updatedAt: this.now().toISOString(),
    });

    if (updated) {
      paymentLogger.logStatusUpdated(updated.id, intent.status, updated.status, this.provider.name);
    }

    return updated;
  }
}

export class MockPaymentProviderAdapter implements PaymentProviderAdapter {
  readonly name: PaymentProvider = 'mock';

  async createCheckout(_input: ProviderCheckoutInput): Promise<{ providerIntentId: string; checkoutUrl: string | null }> {
    const providerIntentId = `mock_${Math.random().toString(36).slice(2, 12)}`;
    return {
      providerIntentId,
      checkoutUrl: null,
    };
  }
}

export class InMemoryPaymentRepository implements PaymentRepository {
  private readonly records = new Map<string, PaymentIntent>();
  private readonly providerIndex = new Map<string, string>();

  async create(intent: PaymentIntent): Promise<PaymentIntent> {
    this.records.set(intent.id, intent);
    if (intent.providerIntentId) {
      this.providerIndex.set(`${intent.provider}:${intent.providerIntentId}`, intent.id);
    }
    return intent;
  }

  async findById(id: string): Promise<PaymentIntent | null> {
    return this.records.get(id) ?? null;
  }

  async findByProviderIntentId(provider: PaymentProvider, providerIntentId: string): Promise<PaymentIntent | null> {
    const id = this.providerIndex.get(`${provider}:${providerIntentId}`);
    return id ? (this.records.get(id) ?? null) : null;
  }

  async update(id: string, patch: Partial<PaymentIntent>): Promise<PaymentIntent | null> {
    const existing = this.records.get(id);
    if (!existing) return null;
    const updated: PaymentIntent = { ...existing, ...patch, id: existing.id };
    this.records.set(id, updated);
    return updated;
  }

  async listByEmail(email: string): Promise<PaymentIntent[]> {
    return Array.from(this.records.values()).filter((r) => r.email === email);
  }
}
