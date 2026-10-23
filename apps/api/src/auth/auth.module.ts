import { createSessionCookieOptions } from '../main';
import { AuthController } from './auth.controller';
import { AuthService, type AuthServiceOptions } from './auth.service';
import { SessionGuard } from './session.guard';
import { SessionStore } from './session-store';

export interface AuthModuleInstance {
  authController: AuthController;
  authService: AuthService;
  sessionGuard: SessionGuard;
}

export type AuthModuleOptions = AuthServiceOptions & { sessionStore?: SessionStore };

export function createAuthModule(options: AuthModuleOptions = {}): AuthModuleInstance {
  const authService = new AuthService(options);
  const sessionGuard = new SessionGuard({ allowPendingPlanSelection: true });
  const configuredSecret = options.env?.OAUTH_TOKEN_KEY ?? process.env.OAUTH_TOKEN_KEY;
  if (!configuredSecret && (options.env?.NODE_ENV ?? process.env.NODE_ENV) === 'production') {
    throw new Error('OAUTH_TOKEN_KEY is required for production sessions.');
  }
  const sessionStore = options.sessionStore ?? new SessionStore({
    secret: configuredSecret ?? 'development-only-session-secret',
  });
  const authController = new AuthController(authService, createSessionCookieOptions(options.env), sessionGuard, sessionStore);

  return {
    authController,
    authService,
    sessionGuard,
  };
}
