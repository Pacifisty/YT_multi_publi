import type { AuthController } from '../auth/auth.controller';
import { SessionGuard, type SessionRequestLike } from '../auth/session.guard';
import { AccountPlanAccessError, AccountPlanService, type AccountPlanType } from './account-plan.service';

export interface AccountPlanRequest extends SessionRequestLike {
  body?: unknown;
}

export class AccountPlanController {
  private readonly authController?: AuthController;

  constructor(
    private readonly accountPlanService: AccountPlanService,
    private readonly sessionGuard: SessionGuard,
    authController?: AuthController,
  ) {
    this.authController = authController;
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
    if (normalizedPlan !== 'FREE' && normalizedPlan !== 'BASIC' && normalizedPlan !== 'PRO') {
      return {
        status: 400,
        body: {
          error: 'Plano invalido. Use FREE, BASIC ou PRO.',
        },
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
}
