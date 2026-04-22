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

export function createAuthModule(options: AuthServiceOptions = {}): AuthModuleInstance {
  const authService = new AuthService(options);
  const sessionGuard = new SessionGuard({ allowPendingPlanSelection: true });
  const sessionStore = new SessionStore({
    secret: options.env?.OAUTH_TOKEN_KEY ?? process.env.OAUTH_TOKEN_KEY ?? '',
  });
  const authController = new AuthController(authService, createSessionCookieOptions(options.env), sessionGuard, sessionStore);

  return {
    authController,
    authService,
    sessionGuard,
  };
}
