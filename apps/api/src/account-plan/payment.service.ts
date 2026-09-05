import type { AccountPlanType, AccountPlanDefinition, TokenPackDefinition } from './account-plan.service';
import { paymentLogger } from '../common/payment-logger';
import type { EmailService } from '../integrations/email/email-service';
import type { WebhookDeduplicator } from './webhook-deduplication';

export type PaymentProvider = 'stripe' | 'mercadopago' | 'mock';
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded';
export type FulfillmentStatus = 'pending' | 'processing' | 'completed' | 'failed';

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
  fulfillmentStatus?: FulfillmentStatus;
  fulfillmentError?: string | null;
  fulfillmentStartedAt?: string | null;
  fulfilledAt?: string | null;
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
  providerEventId?: string;
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
  claimFulfillment?(id: string, startedAt: string): Promise<PaymentIntent | null>;
}

export interface PaymentServiceOptions {
  provider?: PaymentProviderAdapter;
  repository?: PaymentRepository;
  webhookDeduplicator?: WebhookDeduplicator | null;
  emailService?: EmailService;
  accountPlanService?: any; // Optional to get plan definitions for emails
  logger?: any;
  now?: () => Date;
  defaultSuccessUrl?: string;
  defaultCancelUrl?: string;
  defaultNotificationUrl?: string;
}

export class PaymentService {
  private readonly provider: PaymentProviderAdapter;
  private readonly repository: PaymentRepository;
  private readonly webhookDeduplicator: WebhookDeduplicator | null;
  private readonly emailService?: EmailService;
  private readonly accountPlanService?: any;
  private readonly logger?: any;
  private readonly now: () => Date;
  private readonly defaultSuccessUrl: string | undefined;
  private readonly defaultCancelUrl: string | undefined;
  private readonly defaultNotificationUrl: string | undefined;

  constructor(options: PaymentServiceOptions = {}) {
    this.provider = options.provider ?? new MockPaymentProviderAdapter();
    this.repository = options.repository ?? new InMemoryPaymentRepository();
    this.webhookDeduplicator = options.webhookDeduplicator ?? null;
    this.emailService = options.emailService;
    this.accountPlanService = options.accountPlanService;
    this.logger = options.logger;
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

    const intent: PaymentIntent = {
      id,
      provider: this.provider.name,
      providerIntentId: null,
      email: input.email.trim().toLowerCase(),
      purchase,
      amountBrl,
      currency: 'BRL',
      status: 'pending',
      checkoutUrl: null,
      externalReference: id,
      errorMessage: null,
      createdAt: nowIso,
      updatedAt: nowIso,
      paidAt: null,
      fulfillmentStatus: 'pending',
      fulfillmentError: null,
      fulfillmentStartedAt: null,
      fulfilledAt: null,
    };

    await this.repository.create(intent);

    let providerResult: { providerIntentId: string; checkoutUrl: string | null };
    try {
      providerResult = await this.provider.createCheckout({
        email: input.email,
        purchase,
        amountBrl,
        successUrl,
        cancelUrl,
        externalReference: id,
        notificationUrl: this.defaultNotificationUrl,
      });
    } catch (error) {
      await this.repository.update(id, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Payment provider request failed',
        updatedAt: this.now().toISOString(),
      });
      throw error;
    }

    const saved = await this.repository.update(id, {
      providerIntentId: providerResult.providerIntentId,
      checkoutUrl: providerResult.checkoutUrl,
      updatedAt: this.now().toISOString(),
    });

    if (!saved) {
      throw new Error(`Payment intent ${id} disappeared before checkout could be finalized.`);
    }

    const purchaseId = purchase.kind === 'plan' ? purchase.planCode : purchase.packId;
    paymentLogger.logCheckoutCreated(saved.id, saved.email, purchaseId, amountBrl);

    return {
      intent: saved,
      redirectUrl: providerResult.checkoutUrl,
    };
  }

  private async notifyPaymentSuccess(intent: PaymentIntent): Promise<void> {
    if (!this.emailService || intent.status !== 'paid') {
      return;
    }

    try {
      const { buildPaymentEmail } = await import('../integrations/email/email-templates');

      let planName = 'Plan';
      let tokensGranted = 0;

      if (intent.purchase.kind === 'plan') {
        const planCode = intent.purchase.planCode;
        planName = planCode.toUpperCase();
        // Get token count from account plan service if available
        if (this.accountPlanService) {
          const plans = this.accountPlanService.getPlans?.();
          const plan = plans?.find((p: any) => p.code === planCode);
          tokensGranted = plan?.tokens ?? 1000;
        } else {
          // Fallback token counts
          const codeStr = String(planCode).toLowerCase();
          if (codeStr === 'basic') {
            tokensGranted = 100;
          } else if (codeStr === 'pro') {
            tokensGranted = 500;
          } else {
            tokensGranted = 1000;
          }
        }
      } else if (intent.purchase.kind === 'token_pack') {
        tokensGranted = intent.purchase.tokens;
        planName = `${tokensGranted} Tokens Pack`;
      }

      const costStr = `R$ ${intent.amountBrl.toFixed(2)}`;
      const emailData = buildPaymentEmail(intent.email, {
        planName,
        tokensGranted,
        totalCost: costStr,
        userEmail: intent.email,
      });
      await this.emailService.send(emailData);
    } catch (error) {
      this.logger?.warn('Failed to send payment confirmation email', {
        paymentId: intent.id,
        email: intent.email,
        error: error instanceof Error ? error.message : String(error),
      });
    }
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

    // In production the Prisma implementation atomically claims the event.
    // The legacy pre-check remains for test/in-memory implementations.
    if (this.webhookDeduplicator && verified.providerEventId) {
      if (this.webhookDeduplicator.claimWebhookEvent) {
        const claimed = await this.webhookDeduplicator.claimWebhookEvent(
          this.provider.name,
          verified.providerEventId,
          verified.externalReference ?? verified.providerIntentId ?? 'unknown',
          'payment',
          rawBody,
        );
        if (!claimed) return null;
      } else {
        const alreadyProcessed = await this.webhookDeduplicator.hasProcessedEvent(this.provider.name, verified.providerEventId);
        if (alreadyProcessed) return null;
      }
    }

    let intent: PaymentIntent | null = null;
    if (verified.externalReference) {
      intent = await this.repository.findById(verified.externalReference);
    }
    if (!intent && verified.providerIntentId) {
      intent = await this.repository.findByProviderIntentId(this.provider.name, verified.providerIntentId);
    }
    if (!intent) return null;

    if (intent.status === verified.status) {
      if (
        this.webhookDeduplicator
        && verified.providerEventId
        && (intent.status !== 'paid' || !this.webhookDeduplicator.completeWebhookEventsForReference)
      ) {
        await this.webhookDeduplicator.recordWebhookEvent(
          this.provider.name,
          verified.providerEventId,
          intent.id,
          'payment',
          rawBody,
        );
      }
      return intent.status === 'paid' && intent.fulfillmentStatus !== 'completed' ? intent : null;
    }

    paymentLogger.logWebhookReceived(intent.id, this.provider.name, rawBody.length);
    const oldStatus = intent.status;
    const updated = await this.repository.update(intent.id, {
      status: verified.status,
      paidAt: verified.status === 'paid' ? this.now().toISOString() : intent.paidAt,
      updatedAt: this.now().toISOString(),
    });

    if (updated && this.webhookDeduplicator && verified.providerEventId) {
      if (updated.status !== 'paid' || !this.webhookDeduplicator.completeWebhookEventsForReference) {
        await this.webhookDeduplicator.recordWebhookEvent(this.provider.name, verified.providerEventId, intent.id, 'payment', rawBody);
      }
      paymentLogger.logStatusUpdated(updated.id, oldStatus, updated.status, this.provider.name);
    }

    // Send email notification if payment is now paid
    if (updated) {
      await this.notifyPaymentSuccess(updated);
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
      // Send email notification if payment is now paid
      await this.notifyPaymentSuccess(updated);
    }

    return updated;
  }

  async claimFulfillment(id: string): Promise<PaymentIntent | null> {
    const startedAt = this.now().toISOString();
    if (this.repository.claimFulfillment) {
      return this.repository.claimFulfillment(id, startedAt);
    }

    const intent = await this.repository.findById(id);
    if (!intent || intent.status !== 'paid' || intent.fulfillmentStatus === 'completed' || intent.fulfillmentStatus === 'processing') {
      return null;
    }
    return this.repository.update(id, {
      fulfillmentStatus: 'processing',
      fulfillmentError: null,
      fulfillmentStartedAt: startedAt,
      updatedAt: startedAt,
    });
  }

  async completeFulfillment(id: string): Promise<PaymentIntent | null> {
    const now = this.now().toISOString();
    const updated = await this.repository.update(id, {
      fulfillmentStatus: 'completed',
      fulfillmentError: null,
      fulfilledAt: now,
      updatedAt: now,
    });
    if (updated && this.webhookDeduplicator?.completeWebhookEventsForReference) {
      await this.webhookDeduplicator.completeWebhookEventsForReference(id);
    }
    return updated;
  }

  async failFulfillment(id: string, error: unknown): Promise<PaymentIntent | null> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const updated = await this.repository.update(id, {
      fulfillmentStatus: 'failed',
      fulfillmentError: errorMessage,
      updatedAt: this.now().toISOString(),
    });
    if (this.webhookDeduplicator?.failWebhookEventsForReference) {
      await this.webhookDeduplicator.failWebhookEventsForReference(id, errorMessage);
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

  async claimFulfillment(id: string, startedAt: string): Promise<PaymentIntent | null> {
    const intent = this.records.get(id);
    if (!intent || intent.status !== 'paid' || intent.fulfillmentStatus === 'processing' || intent.fulfillmentStatus === 'completed') {
      return null;
    }
    return this.update(id, {
      fulfillmentStatus: 'processing',
      fulfillmentError: null,
      fulfillmentStartedAt: startedAt,
      updatedAt: startedAt,
    });
  }
}
