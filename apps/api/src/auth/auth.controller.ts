import { SESSION_COOKIE_NAME, createSessionCookieOptions, type SessionCookieOptions } from '../main';
import type { LoginDto } from './dto/login.dto';
import { validateLoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { SessionGuard, type SessionRequestLike } from './session.guard';

export interface AuthRequest extends SessionRequestLike {
  body?: Partial<LoginDto>;
}

export interface CookieDescriptor extends SessionCookieOptions {
  value: string;
}

export interface ControllerResponse<TBody> {
  status: number;
  body: TBody;
  cookies: CookieDescriptor[];
}

export class AuthController {
  private readonly sessionGuard: SessionGuard;

  constructor(
    private readonly authService: AuthService,
    private readonly cookieOptions: SessionCookieOptions = createSessionCookieOptions(),
    sessionGuard?: SessionGuard,
  ) {
    this.sessionGuard = sessionGuard ?? new SessionGuard();
  }

  async login(request: AuthRequest): Promise<ControllerResponse<{ error?: string; user?: { email: string } }>> {
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

    if (!result.ok) {
      return {
        status: result.status,
        body: {
          error: result.message,
        },
        cookies: [],
      };
    }

    return {
      status: 200,
      body: {
        user: {
          email: result.user.email,
        },
      },
      cookies: [
        {
          ...this.cookieOptions,
          name: SESSION_COOKIE_NAME,
          value: result.sessionId,
        },
      ],
    };
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

  async me(request: SessionRequestLike): Promise<ControllerResponse<{ error?: string; user?: { email: string } }>> {
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

    return {
      status: 200,
      body: {
        user: {
          email: user?.email ?? '',
        },
      },
      cookies: [],
    };
  }
}
