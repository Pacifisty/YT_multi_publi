import type { AuthController } from '../auth/auth.controller';
import { SessionGuard, type SessionRequestLike } from '../auth/session.guard';
import {
  ACCOUNT_PLAN_DEFINITIONS,
  AccountPlanAccessError,
  AccountPlanService,
  TOKEN_PACK_DEFINITIONS,
  type AccountPlanType,
} from './account-plan.service';
import type { PaymentService } from './payment.service';
import { paymentLogger } from '../common/payment-logger';

export interface AccountPlanRequest extends SessionRequestLike {
  body?: unknown;
  params?: Record<string, string>;
}

export interface AccountPlanControllerOptions {
  allowDevMarkPaid?: boolean;
}

const VALID_PLAN_CODES: AccountPlanType[] = ['FREE', 'BASIC', 'PRO', 'PREMIUM'];

export class AccountPlanController {
  private readonly authController?: AuthController;
  private readonly paymentService?: PaymentService;
  private readonly allowDevMarkPaid: boolean;

  constructor(
    private readonly accountPlanService: AccountPlanService,
    private readonly sessionGuard: SessionGuard,
    authController?: AuthController,
    paymentService?: PaymentService,
    options: AccountPlanControllerOptions = {},
  ) {
    this.authController = authController;
    this.paymentService = paymentService;
    this.allowDevMarkPaid = options.allowDevMarkPaid ?? process.env.NODE_ENV !== 'production';
  }

  listPlans(_request: SessionRequestLike) {
    return {
      status: 200,
      body: {
        plans: this.accountPlanService.listAvailablePlans().map((p) => ({
          id: p.id,
          code: p.code,
          name: p.label,
          priceBrl: p.priceBrl,
          tokens: p.maxTokens,
          dailyVisitTokens: p.dailyVisitTokens,
          campaignPublishCostTokens: p.campaignPublishCostTokens,
          thumbnailCostTokens: p.thumbnailCostTokens,
          allowedPlatforms: p.allowedPlatforms,
          durationDays: p.durationDays,
          benefits: p.benefits,
          active: p.active,
        })),
      },
    };
  }

  listTokenPacks(_request: SessionRequestLike) {
    return {
      status: 200,
      body: {
        packs: this.accountPlanService.listAvailableTokenPacks().map((p) => ({
          id: p.id,
          label: p.label,
          tokens: p.tokens,
          priceBrl: p.priceBrl,
          active: p.active,
        })),
      },
    };
  }

  async createCheckout(request: AccountPlanRequest) {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }
    const email = request.session?.adminUser?.email;
    if (!email) {
      return { status: 401, body: { error: 'Authentication required.' } };
    }
    if (!this.paymentService) {
      return { status: 503, body: { error: 'Payment service not configured.' } };
    }

    const body = request.body as { plan?: string; successUrl?: string; cancelUrl?: string } | undefined;
    const normalizedPlan = typeof body?.plan === 'string' ? body.plan.trim().toUpperCase() : '';
    if (!VALID_PLAN_CODES.includes(normalizedPlan as AccountPlanType)) {
      return { status: 400, body: { error: `Plano invalido. Use ${VALID_PLAN_CODES.join(', ')}.` } };
    }

    const definition = ACCOUNT_PLAN_DEFINITIONS[normalizedPlan as AccountPlanType];
    if (!definition.priceBrl || definition.priceBrl <= 0) {
      return { status: 400, body: { error: 'Plano gratuito nao requer pagamento.' } };
    }

    try {
      // Use provided URLs or construct from public app URL
      const publicUrl = process.env.PUBLIC_APP_URL || `http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || '3000'}`;
      const result = await this.paymentService.createCheckout({
        kind: 'plan',
        email,
        planDefinition: definition,
        successUrl: body?.successUrl || `${publicUrl}/account/billing?payment_status=success`,
        cancelUrl: body?.cancelUrl || `${publicUrl}/account/billing?payment_status=cancel`,
      });
      return {
        status: 200,
        body: {
          intent: result.intent,
          redirectUrl: result.redirectUrl,
        },
      };
    } catch (error) {
      return {
        status: 500,
        body: { error: error instanceof Error ? error.message : 'Nao foi possivel criar checkout.' },
      };
    }
  }

  async createTokenPackCheckout(request: AccountPlanRequest) {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }
    const email = request.session?.adminUser?.email;
    if (!email) {
      return { status: 401, body: { error: 'Authentication required.' } };
    }
    if (!this.paymentService) {
      return { status: 503, body: { error: 'Payment service not configured.' } };
    }

    const body = request.body as { packId?: string; successUrl?: string; cancelUrl?: string } | undefined;
    const packId = typeof body?.packId === 'string' ? body.packId.trim() : '';
    const pack = TOKEN_PACK_DEFINITIONS[packId];
    if (!pack || !pack.active) {
      const valid = Object.keys(TOKEN_PACK_DEFINITIONS).join(', ');
      return { status: 400, body: { error: `Pacote invalido. Use ${valid}.` } };
    }

    try {
      // Use provided URLs or construct from public app URL
      const publicUrl = process.env.PUBLIC_APP_URL || `http://${process.env.HOST || '127.0.0.1'}:${process.env.PORT || '3000'}`;
      const result = await this.paymentService.createCheckout({
        kind: 'token_pack',
        email,
        pack,
        successUrl: body?.successUrl || `${publicUrl}/account/tokens?payment_status=success`,
        cancelUrl: body?.cancelUrl || `${publicUrl}/account/tokens?payment_status=cancel`,
      });
      return {
        status: 200,
        body: {
          intent: result.intent,
          redirectUrl: result.redirectUrl,
        },
      };
    } catch (error) {
      return {
        status: 500,
        body: { error: error instanceof Error ? error.message : 'Nao foi possivel criar checkout.' },
      };
    }
  }

  async getPaymentIntent(request: AccountPlanRequest) {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }
    if (!this.paymentService) {
      return { status: 503, body: { error: 'Payment service not configured.' } };
    }

    const intentId = request.params?.intentId;
    if (!intentId) {
      return { status: 400, body: { error: 'Missing intent id.' } };
    }

    const intent = await this.paymentService.getIntent(intentId);
    if (!intent) {
      return { status: 404, body: { error: 'Payment intent not found.' } };
    }

    return { status: 200, body: { intent } };
  }

  async listMyPayments(request: SessionRequestLike) {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }
    const email = request.session?.adminUser?.email;
    if (!email) {
      return { status: 401, body: { error: 'Authentication required.' } };
    }
    if (!this.paymentService) {
      return { status: 503, body: { error: 'Payment service not configured.' } };
    }

    const intents = await this.paymentService.listIntentsForEmail(email);
    return { status: 200, body: { intents } };
  }

  async paymentWebhook(request: AccountPlanRequest) {
    if (!this.paymentService) {
      return { status: 503, body: { error: 'Payment service not configured.' } };
    }
    const headers = (request as any).headers ?? {};
    const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? {});
    try {
      paymentLogger.logWebhookReceived('webhook-in-progress', 'unknown', rawBody.length);
      const updated = await this.paymentService.handleWebhook(headers, rawBody);
      if (updated) {
        paymentLogger.logStatusUpdated(updated.id, 'unknown', updated.status, updated.provider);
        if (updated?.status === 'paid') {
          await this.applyPaidIntent(updated);
        }
      }
      return { status: 200, body: { received: true, intent: updated } };
    } catch (error) {
      paymentLogger.logError('unknown-webhook', 'webhook_handler', error instanceof Error ? error.message : 'Webhook processing failed.');
      return {
        status: 400,
        body: { error: error instanceof Error ? error.message : 'Webhook processing failed.' },
      };
    }
  }

  async markIntentPaid(request: AccountPlanRequest) {
    if (!this.allowDevMarkPaid) {
      return { status: 404, body: { error: 'Not found.' } };
    }
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }
    if (!this.paymentService) {
      return { status: 503, body: { error: 'Payment service not configured.' } };
    }

    const intentId = request.params?.intentId;
    if (!intentId) {
      return { status: 400, body: { error: 'Missing intent id.' } };
    }

    const updated = await this.paymentService.markStatus(intentId, 'paid');
    if (!updated) {
      return { status: 404, body: { error: 'Payment intent not found.' } };
    }

    await this.applyPaidIntent(updated);
    return { status: 200, body: { intent: updated } };
  }

  async getCurrentPlan(request: SessionRequestLike) {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const email = request.session?.adminUser?.email;
    if (!email) {
      return { status: 401, body: { error: 'Authentication required.' } };
    }

    return {
      status: 200,
      body: {
        account: await this.accountPlanService.getAccount(email),
      },
    };
  }

  async claimDailyVisit(request: SessionRequestLike) {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const email = request.session?.adminUser?.email;
    if (!email) {
      return { status: 401, body: { error: 'Authentication required.' } };
    }

    const result = await this.accountPlanService.claimDailyVisit(email);
    return {
      status: 200,
      body: result,
    };
  }

  async claimMonthlyGrant(request: SessionRequestLike) {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const email = request.session?.adminUser?.email;
    if (!email) {
      return { status: 401, body: { error: 'Authentication required.' } };
    }

    const result = await this.accountPlanService.claimMonthlyGrant(email);
    return { status: 200, body: result };
  }

  async selectPlan(request: AccountPlanRequest) {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return { status: guardResult.status, body: { error: guardResult.reason } };
    }

    const email = request.session?.adminUser?.email;
    if (!email) {
      return { status: 401, body: { error: 'Authentication required.' } };
    }

    const body = request.body as { plan?: string } | undefined;
    const normalizedPlan = typeof body?.plan === 'string' ? body.plan.trim().toUpperCase() : '';
    if (!VALID_PLAN_CODES.includes(normalizedPlan as AccountPlanType)) {
      return {
        status: 400,
        body: { error: `Plano invalido. Use ${VALID_PLAN_CODES.join(', ')}.` },
      };
    }

    try {
      const result = await this.accountPlanService.selectPlan(email, normalizedPlan as AccountPlanType);
      if (this.authController) {
        const refreshed = await this.authController.refreshAuthenticatedUser(request, email);
        return {
          ...refreshed,
          body: {
            ...refreshed.body,
            account: result.account,
          },
        };
      }
      return {
        status: 200,
        body: result,
      };
    } catch (error) {
      if (error instanceof AccountPlanAccessError) {
        return { status: error.statusCode, body: { error: error.message } };
      }

      return {
        status: 500,
        body: {
          error: error instanceof Error ? error.message : 'Nao foi possivel atualizar o plano.',
        },
      };
    }
  }

  private async applyPaidIntent(
    intent: import('./payment.service').PaymentIntent,
  ): Promise<void> {
    try {
      if (intent.purchase.kind === 'plan') {
        await this.accountPlanService.selectPlan(intent.email, intent.purchase.planCode);
        return;
      }
      if (intent.purchase.kind === 'token_pack') {
        await this.accountPlanService.creditTokens(intent.email, intent.purchase.tokens, intent.id);
        paymentLogger.logTokensCredited(intent.email, intent.purchase.tokens, intent.id);
      }
    } catch (error) {
      paymentLogger.logError(intent.id, 'apply_paid_intent', error instanceof Error ? error.message : 'Failed to apply paid intent', { email: intent.email, purchaseKind: intent.purchase.kind });
      throw error;
    }
  }
}
