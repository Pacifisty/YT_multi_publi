import { describe, expect, test, vi } from 'vitest';

import { AuthController } from '../../apps/api/src/auth/auth.controller';
import { AuthService } from '../../apps/api/src/auth/auth.service';
import { InMemoryAuthUserRepository } from '../../apps/api/src/auth/auth-user.repository';
import { SessionGuard } from '../../apps/api/src/auth/session.guard';
import { createSessionCookieOptions } from '../../apps/api/src/main';
import { getSeedAdminUser } from '../../prisma/seed';

function createSession() {
  return {
    id: 'session-1',
    regenerate(callback: (error?: Error) => void) {
      this.id = 'session-2';
      callback();
    },
    destroy(callback?: () => void) {
      delete this.adminUser;
      callback?.();
    },
  } as {
    id: string;
    adminUser?: { email: string };
    regenerate: (callback: (error?: Error) => void) => void;
    destroy: (callback?: () => void) => void;
  };
}

describe('seeded admin session authentication boundary', () => {
  test('seeds exactly one admin user from environment values', () => {
    const seededAdmin = getSeedAdminUser({
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD_HASH: 'plain:correct-horse-battery-staple',
    });

    expect(seededAdmin).toMatchObject({
      email: 'admin@example.com',
      passwordHash: 'plain:correct-horse-battery-staple',
      isActive: true,
    });
  });

  test('returns 200 and sets a hardened session cookie for valid credentials', async () => {
    const env = {
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD_HASH: 'plain:correct-horse-battery-staple',
      NODE_ENV: 'test',
    };
    const authService = new AuthService({ env });
    const controller = new AuthController(authService, createSessionCookieOptions(env));

    const response = await controller.login({
      body: {
        email: 'admin@example.com',
        password: 'correct-horse-battery-staple',
      },
      session: createSession(),
    });

    expect(response.status).toBe(200);
    expect(response.cookies).toContainEqual(
      expect.objectContaining({
        name: 'gsd_admin_session',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 43_200_000,
      }),
    );
    expect(response.body.user?.email).toBe('admin@example.com');
    expect(response.body.user?.needsPlanSelection).toBe(false);
  });

  test('returns 401 and no session cookie for invalid credentials', async () => {
    const env = {
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD_HASH: 'plain:correct-horse-battery-staple',
      NODE_ENV: 'test',
    };
    const authService = new AuthService({ env });
    const controller = new AuthController(authService, createSessionCookieOptions(env));

    const response = await controller.login({
      body: {
        email: 'admin@example.com',
        password: 'wrong-password',
      },
      session: createSession(),
    });

    expect(response.status).toBe(401);
    expect(response.cookies).toEqual([]);
  });

  test('registers a new account and flags plan selection as required', async () => {
    const controller = new AuthController(new AuthService(), createSessionCookieOptions({ NODE_ENV: 'test' }));

    const response = await controller.register({
      body: {
        email: 'creator@example.com',
        password: 'secret123',
        fullName: 'Creator User',
      },
      session: createSession(),
    });

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      email: 'creator@example.com',
      fullName: 'Creator User',
      needsPlanSelection: true,
    });
  });

  test('logs in an existing Google-linked account only via Google sign-in', async () => {
    const repo = new InMemoryAuthUserRepository([
      {
        id: 'user-1',
        email: 'google-user@example.com',
        fullName: 'Google User',
        passwordHash: null,
        googleSubject: 'google-sub-123',
        isActive: true,
        planSelectionCompleted: false,
        createdAt: new Date('2026-04-22T00:00:00.000Z'),
        updatedAt: new Date('2026-04-22T00:00:00.000Z'),
      },
    ]);
    const controller = new AuthController(
      new AuthService({ userStore: repo }),
      createSessionCookieOptions({ NODE_ENV: 'test' }),
    );

    const response = await controller.login({
      body: {
        email: 'google-user@example.com',
        password: 'whatever',
      },
      session: createSession(),
    });

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Google');
  });

  test('passes the request session into Google OAuth start', async () => {
    const session = createSession() as ReturnType<typeof createSession> & { oauthStateNonce?: string };
    const createGoogleAuthorizationRedirect = vi.fn(async (oauthSession?: { oauthStateNonce?: string } | null) => {
      if (oauthSession) {
        oauthSession.oauthStateNonce = 'oauth-state-123';
      }
      return 'https://accounts.google.com/o/oauth2/v2/auth?state=oauth-state-123';
    });
    const controller = new AuthController(
      {
        createGoogleAuthorizationRedirect,
      } as unknown as AuthService,
      createSessionCookieOptions({ NODE_ENV: 'test' }),
    );

    const response = await controller.startGoogleOauth({
      session,
    });

    expect(response.status).toBe(200);
    expect(response.body.redirectUrl).toContain('oauth-state-123');
    expect(createGoogleAuthorizationRedirect).toHaveBeenCalledWith(session);
    expect(session.oauthStateNonce).toBe('oauth-state-123');
  });

  test('uses the development Google login fallback when OAuth credentials are placeholders', async () => {
    const env = {
      ADMIN_EMAIL: 'admin@example.com',
      ADMIN_PASSWORD_HASH: 'plain:correct-horse-battery-staple',
      GOOGLE_CLIENT_ID: 'replace-me',
      GOOGLE_CLIENT_SECRET: 'replace-me',
      GOOGLE_AUTH_REDIRECT_URI: 'http://127.0.0.1:3000/login/callback',
      NODE_ENV: 'development',
    };
    const session = createSession() as ReturnType<typeof createSession> & { oauthStateNonce?: string };
    const controller = new AuthController(
      new AuthService({ env }),
      createSessionCookieOptions(env),
    );

    const startResponse = await controller.startGoogleOauth({ session });
    const redirectUrl = new URL(String(startResponse.body.redirectUrl));
    const state = redirectUrl.searchParams.get('state') ?? '';
    const code = redirectUrl.searchParams.get('code') ?? '';

    expect(startResponse.status).toBe(200);
    expect(code).toBe('dev-google-login');
    expect(state).toBeTruthy();
    expect(session.oauthStateNonce).toBe(state);

    const callbackResponse = await controller.handleGoogleOauthCallback({
      query: {
        code,
        state,
      },
      session,
    });

    expect(callbackResponse.status).toBe(200);
    expect(callbackResponse.body.user).toMatchObject({
      email: 'admin@example.com',
      needsPlanSelection: false,
    });
  });

  test('session guard blocks unauthenticated requests with 401', () => {
    const guard = new SessionGuard();

    expect(guard.check({ session: {} as never })).toEqual({
      allowed: false,
      reason: 'Unauthorized',
      status: 401,
    });

    expect(
      guard.check({
        session: {
          adminUser: {
            email: 'admin@example.com',
          },
        } as never,
      }),
    ).toEqual({ allowed: true });
  });
});
