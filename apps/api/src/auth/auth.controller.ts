import { SESSION_COOKIE_NAME, createSessionCookieOptions, type SessionCookieOptions } from '../main';
import type { LoginDto } from './dto/login.dto';
import { validateLoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { validateRegisterDto } from './dto/register.dto';
import { AuthService } from './auth.service';
import { SessionGuard, type SessionRequestLike } from './session.guard';
import { SessionStore } from './session-store';

export interface AuthRequest extends SessionRequestLike {
  body?: Partial<LoginDto & RegisterDto>;
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

  async startGoogleOauth(): Promise<ControllerResponse<{ error?: string; redirectUrl?: string }>> {
    try {
      const redirectUrl = await this.authService.createGoogleAuthorizationRedirect();
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

    if (!guardResult.allowed && !request.session?.adminUser?.email) {
      return {
        status: guardResult.status,
        body: {
          error: guardResult.reason,
        },
        cookies: [],
      };
    }

    const user = this.authService.getCurrentUser(request.session);

    return {
      status: 200,
      body: {
        user: user?.email
          ? {
              email: user.email,
              fullName: user.fullName,
              needsPlanSelection: Boolean(user.needsPlanSelection),
            }
          : undefined,
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
        })
      : request.session?.id ?? '';

    return {
      status: 200,
      body: {
        user: {
          email: refreshedUser.email,
          fullName: refreshedUser.fullName,
          needsPlanSelection: Boolean(refreshedUser.needsPlanSelection),
        },
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
        })
      : result.sessionId;

    return {
      status: 200,
      body: {
        user: {
          email: result.user.email,
          fullName: result.user.fullName,
          needsPlanSelection: Boolean(result.user.needsPlanSelection),
        },
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
}
