import { createSessionCookieOptions } from '../main';
import { AuthController } from './auth.controller';
import { AuthService, type AuthServiceOptions } from './auth.service';
import { SessionGuard } from './session.guard';

export interface AuthModuleInstance {
  authController: AuthController;
  authService: AuthService;
  sessionGuard: SessionGuard;
}

export function createAuthModule(options: AuthServiceOptions = {}): AuthModuleInstance {
  const authService = new AuthService(options);
  const sessionGuard = new SessionGuard();
  const authController = new AuthController(authService, createSessionCookieOptions(options.env), sessionGuard);

  return {
    authController,
    authService,
    sessionGuard,
  };
}
