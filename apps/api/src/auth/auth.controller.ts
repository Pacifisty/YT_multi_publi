import { SESSION_COOKIE_NAME, createSessionCookieOptions, type SessionCookieOptions } from '../main';
import type { LoginDto } from './dto/login.dto';
import { validateLoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { validateRegisterDto } from './dto/register.dto';
import { AuthService, type AccountDeletionSchedule } from './auth.service';
import { SessionGuard, type SessionRequestLike } from './session.guard';
import { SessionStore } from './session-store';

export interface AuthRequest extends SessionRequestLike {
  body?: Partial<LoginDto & RegisterDto> & {
    currentPassword?: string;
    confirmationCode?: string;
  };
  query?: {
    code?: string;
    state?: string;
  };
}

export interface CookieDescriptor extends SessionCookieOptions {
  value: string;
}

export interface ControllerResponse<TBody> {
  status: number;
  body: TBody;
  cookies: CookieDescriptor[];
}

type AuthenticatedUserResponse = {
  email: string;
  fullName?: string;
  needsPlanSelection: boolean;
  accountDeletionConfirmationMethod?: 'password' | 'email_code';
  accountDeletion?: AccountDeletionSchedule | null;
};

export class AuthController {
  private readonly sessionGuard: SessionGuard;
  private readonly sessionStore?: SessionStore;

  constructor(
    private readonly authService: AuthService,
    private readonly cookieOptions: SessionCookieOptions = createSessionCookieOptions(),
    sessionGuard?: SessionGuard,
    sessionStore?: SessionStore,
  ) {
    this.sessionGuard = sessionGuard ?? new SessionGuard({ allowPendingPlanSelection: true });
    this.sessionStore = sessionStore;
  }

  async login(request: AuthRequest): Promise<ControllerResponse<{ error?: string; user?: AuthenticatedUserResponse }>> {
    const validation = validateLoginDto(request.body);

    if (!validation.ok) {
      return {
        status: 400,
        body: {
          error: validation.errors.join(' '),
        },
        cookies: [],
      };
    }

    const result = await this.authService.login(request.body as LoginDto, request.session);
    return this.toAuthResponse(result);
  }

  async register(request: AuthRequest): Promise<ControllerResponse<{ error?: string; user?: AuthenticatedUserResponse }>> {
    const validation = validateRegisterDto(request.body);

    if (!validation.ok) {
      return {
        status: 400,
        body: {
          error: validation.errors.join(' '),
        },
        cookies: [],
      };
    }

    const result = await this.authService.register(request.body as RegisterDto, request.session);
    return this.toAuthResponse(result);
  }

  async startGoogleOauth(
    request: SessionRequestLike,
  ): Promise<ControllerResponse<{ error?: string; redirectUrl?: string }>> {
    try {
      const redirectUrl = await this.authService.createGoogleAuthorizationRedirect(
        request.session as unknown as { oauthStateNonce?: string } | null | undefined,
      );
      return {
        status: 200,
        body: { redirectUrl },
        cookies: [],
      };
    } catch (error) {
      return {
        status: 500,
        body: {
          error: error instanceof Error ? error.message : 'Unable to start Google sign-in.',
        },
        cookies: [],
      };
    }
  }

  async handleGoogleOauthCallback(
    request: AuthRequest,
  ): Promise<ControllerResponse<{ error?: string; user?: AuthenticatedUserResponse }>> {
    const code = request.query?.code;
    const state = request.query?.state;

    if (!code || !state) {
      return {
        status: 400,
        body: {
          error: 'Missing OAuth callback code or state.',
        },
        cookies: [],
      };
    }

    let result;
    try {
      result = await this.authService.authenticateWithGoogleCallback(
        {
          code,
          state,
          session: request.session as unknown as { oauthStateNonce?: string } | null | undefined,
        },
        request.session,
      );
    } catch (error) {
      return {
        status: 500,
        body: {
          error: error instanceof Error ? error.message : 'Unable to complete Google sign-in.',
        },
        cookies: [],
      };
    }

    return this.toAuthResponse(result);
  }

  async logout(request: SessionRequestLike): Promise<ControllerResponse<{ success: true }>> {
    await this.authService.logout(request.session);

    return {
      status: 200,
      body: {
        success: true,
      },
      cookies: [
        {
          ...this.cookieOptions,
          maxAge: 0,
          name: SESSION_COOKIE_NAME,
          value: '',
        },
      ],
    };
  }

  async me(request: SessionRequestLike): Promise<ControllerResponse<{ error?: string; user?: AuthenticatedUserResponse }>> {
    const guardResult = this.sessionGuard.check(request);

    if (!guardResult.allowed) {
      return {
        status: guardResult.status,
        body: {
          error: guardResult.reason,
        },
        cookies: [],
      };
    }

    const user = this.authService.getCurrentUser(request.session);
    const accountDeletion = user?.email ? await this.authService.getAccountDeletionSchedule(user.email) : null;
    const accountDeletionConfirmationMethod = user?.email
      ? await this.authService.getAccountDeletionConfirmationMethod(user.email)
      : null;

    if (accountDeletion?.status === 'deactivated_pending_deletion') {
      return {
        status: 401,
        body: {
          error: 'This account is deactivated and scheduled for deletion.',
        },
        cookies: [
          {
            ...this.cookieOptions,
            maxAge: 0,
            name: SESSION_COOKIE_NAME,
            value: '',
          },
        ],
      };
    }

    const refreshedToken = this.sessionStore && user?.email && accountDeletion
      ? this.sessionStore.createToken({
          email: user.email,
          fullName: user.fullName,
          needsPlanSelection: user.needsPlanSelection,
          accountDeletionConfirmationMethod: accountDeletionConfirmationMethod ?? user.accountDeletionConfirmationMethod,
          accountDeletionRequestedAt: accountDeletion.requestedAt,
          accountDeactivationAt: accountDeletion.deactivationAt,
          accountDeletionAt: accountDeletion.deletionAt,
        })
      : null;

    return {
      status: 200,
      body: {
        user: user?.email
          ? this.toAuthenticatedUser(user, accountDeletion, accountDeletionConfirmationMethod ?? user.accountDeletionConfirmationMethod)
          : undefined,
      },
      cookies: refreshedToken
        ? [
            {
              ...this.cookieOptions,
              name: SESSION_COOKIE_NAME,
              value: refreshedToken,
            },
          ]
        : [],
    };
  }

  async requestAccountDeletion(
    request: AuthRequest,
  ): Promise<ControllerResponse<{ error?: string; accountDeletion?: AccountDeletionSchedule; alreadyRequested?: boolean }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return {
        status: guardResult.status,
        body: { error: guardResult.reason },
        cookies: [],
      };
    }

    const user = this.authService.getCurrentUser(request.session);
    if (!user?.email) {
      return {
        status: 401,
        body: { error: 'Unauthorized' },
        cookies: [],
      };
    }

    const result = await this.authService.requestAccountDeletion(user.email, request.session, {
      currentPassword: typeof request.body?.currentPassword === 'string' ? request.body.currentPassword : undefined,
      confirmationCode: typeof request.body?.confirmationCode === 'string' ? request.body.confirmationCode : undefined,
    });
    if (!result.ok) {
      return {
        status: result.status,
        body: { error: result.message },
        cookies: [],
      };
    }

    const sessionToken = this.sessionStore
      ? this.sessionStore.createToken({
          email: result.user.email,
          fullName: result.user.fullName,
          needsPlanSelection: result.user.needsPlanSelection,
          accountDeletionConfirmationMethod: result.user.accountDeletionConfirmationMethod,
          accountDeletionRequestedAt: result.schedule.requestedAt,
          accountDeactivationAt: result.schedule.deactivationAt,
          accountDeletionAt: result.schedule.deletionAt,
        })
      : request.session?.id ?? '';

    return {
      status: 200,
      body: {
        accountDeletion: result.schedule,
        alreadyRequested: result.alreadyRequested,
      },
      cookies: sessionToken
        ? [
            {
              ...this.cookieOptions,
              name: SESSION_COOKIE_NAME,
              value: sessionToken,
            },
          ]
        : [],
    };
  }

  async sendAccountDeletionConfirmation(
    request: SessionRequestLike,
  ): Promise<ControllerResponse<{ error?: string; expiresAt?: string; delivery?: 'email' }>> {
    const guardResult = this.sessionGuard.check(request);
    if (!guardResult.allowed) {
      return {
        status: guardResult.status,
        body: { error: guardResult.reason },
        cookies: [],
      };
    }

    const user = this.authService.getCurrentUser(request.session);
    if (!user?.email) {
      return {
        status: 401,
        body: { error: 'Unauthorized' },
        cookies: [],
      };
    }

    const result = await this.authService.sendAccountDeletionConfirmation(user.email);
    if (!result.ok) {
      return {
        status: result.status,
        body: { error: result.message },
        cookies: [],
      };
    }

    return {
      status: 200,
      body: {
        delivery: result.delivery,
        expiresAt: result.expiresAt,
      },
      cookies: [],
    };
  }

  async refreshAuthenticatedUser(
    request: SessionRequestLike,
    email: string,
  ): Promise<ControllerResponse<{ error?: string; user?: AuthenticatedUserResponse }>> {
    const refreshedUser = await this.authService.markPlanSelectionCompleted(email, request.session);
    if (!refreshedUser) {
      return {
        status: 404,
        body: {
          error: 'Authenticated user not found.',
        },
        cookies: [],
      };
    }

    const sessionToken = this.sessionStore
      ? this.sessionStore.createToken({
          email: refreshedUser.email,
          fullName: refreshedUser.fullName,
          needsPlanSelection: refreshedUser.needsPlanSelection,
          accountDeletionConfirmationMethod: refreshedUser.accountDeletionConfirmationMethod,
          accountDeletionRequestedAt: refreshedUser.accountDeletionRequestedAt,
          accountDeactivationAt: refreshedUser.accountDeactivationAt,
          accountDeletionAt: refreshedUser.accountDeletionAt,
        })
      : request.session?.id ?? '';

    return {
      status: 200,
      body: {
        user: this.toAuthenticatedUser(refreshedUser),
      },
      cookies: sessionToken
        ? [
            {
              ...this.cookieOptions,
              name: SESSION_COOKIE_NAME,
              value: sessionToken,
            },
          ]
        : [],
    };
  }

  private toAuthResponse(
    result: Awaited<ReturnType<AuthService['login']>>,
  ): ControllerResponse<{ error?: string; user?: AuthenticatedUserResponse }> {
    if (!result.ok) {
      return {
        status: result.status,
        body: {
          error: result.message,
        },
        cookies: [],
      };
    }

    const sessionToken = this.sessionStore
      ? this.sessionStore.createToken({
          email: result.user.email,
          fullName: result.user.fullName,
          needsPlanSelection: result.user.needsPlanSelection,
          accountDeletionConfirmationMethod: result.user.accountDeletionConfirmationMethod,
          accountDeletionRequestedAt: result.user.accountDeletionRequestedAt,
          accountDeactivationAt: result.user.accountDeactivationAt,
          accountDeletionAt: result.user.accountDeletionAt,
        })
      : result.sessionId;

    return {
      status: 200,
      body: {
        user: this.toAuthenticatedUser(result.user),
      },
      cookies: [
        {
          ...this.cookieOptions,
          name: SESSION_COOKIE_NAME,
          value: sessionToken,
        },
      ],
    };
  }

  private toAuthenticatedUser(
    user: {
      email: string;
      fullName?: string;
      needsPlanSelection?: boolean;
      accountDeletionConfirmationMethod?: 'password' | 'email_code';
      accountDeletionRequestedAt?: string;
      accountDeactivationAt?: string;
      accountDeletionAt?: string;
    },
    accountDeletion = this.toDeletionScheduleFromSessionUser(user),
    accountDeletionConfirmationMethod = user.accountDeletionConfirmationMethod,
  ): AuthenticatedUserResponse {
    const response: AuthenticatedUserResponse = {
      email: user.email,
      fullName: user.fullName,
      needsPlanSelection: Boolean(user.needsPlanSelection),
      accountDeletionConfirmationMethod,
    };
    if (accountDeletion) {
      response.accountDeletion = accountDeletion;
    }
    return response;
  }

  private toDeletionScheduleFromSessionUser(user: {
    accountDeletionRequestedAt?: string;
    accountDeactivationAt?: string;
    accountDeletionAt?: string;
  }): AccountDeletionSchedule | null {
    if (!user.accountDeletionRequestedAt || !user.accountDeactivationAt || !user.accountDeletionAt) {
      return null;
    }

    return {
      requestedAt: user.accountDeletionRequestedAt,
      deactivationAt: user.accountDeactivationAt,
      deletionAt: user.accountDeletionAt,
      status: new Date(user.accountDeactivationAt).getTime() <= Date.now()
        ? 'deactivated_pending_deletion'
        : 'pending_deactivation',
    };
  }
}
