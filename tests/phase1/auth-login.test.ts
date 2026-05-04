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
      accountDeletionConfirmationMethod: 'password',
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

  test('schedules account deletion for 24 hour deactivation and 30 day removal', async () => {
    let now = new Date('2026-05-04T12:00:00.000Z');
    const repo = new InMemoryAuthUserRepository([
      {
        id: 'user-delete-1',
        email: 'creator@example.com',
        fullName: 'Creator',
        passwordHash: 'plain:secret123',
        googleSubject: null,
        isActive: true,
        planSelectionCompleted: true,
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-05-01T00:00:00.000Z'),
      },
    ]);
    const authService = new AuthService({
      userStore: repo,
      now: () => now,
    });
    const controller = new AuthController(authService, createSessionCookieOptions({ NODE_ENV: 'test' }));
    const session = {
      adminUser: {
        email: 'creator@example.com',
        needsPlanSelection: false,
      },
    } as any;

    const rejectedResponse = await controller.requestAccountDeletion({ session });
    expect(rejectedResponse.status).toBe(401);

    const response = await controller.requestAccountDeletion({
      session,
      body: {
        currentPassword: 'secret123',
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.alreadyRequested).toBe(false);
    expect(response.body.accountDeletion).toEqual({
      requestedAt: '2026-05-04T12:00:00.000Z',
      deactivationAt: '2026-05-05T12:00:00.000Z',
      deletionAt: '2026-06-03T12:00:00.000Z',
      status: 'pending_deactivation',
    });

    const meResponse = await controller.me({ session });
    expect(meResponse.body.user?.accountDeletion?.deletionAt).toBe('2026-06-03T12:00:00.000Z');

    const secondResponse = await controller.requestAccountDeletion({ session });
    expect(secondResponse.body.alreadyRequested).toBe(true);

    now = new Date('2026-05-05T12:00:01.000Z');
    const loginResponse = await controller.login({
      body: {
        email: 'creator@example.com',
        password: 'secret123',
      },
      session: createSession(),
    });

    expect(loginResponse.status).toBe(401);
    expect(loginResponse.body.error).toContain('deactivated');

    now = new Date('2026-06-03T12:00:01.000Z');
    const deletionResult = await authService.processDueAccountDeletions();
    expect(deletionResult.processed).toBe(1);
    expect(deletionResult.results[0]).toMatchObject({
      email: 'creator@example.com',
      authUsersAnonymized: 1,
    });
    expect(await repo.findByEmail('creator@example.com')).toBeNull();
  });

  test('requires an emailed code before deleting a Google-only account', async () => {
    const sentEmails: Array<{ to: string; subject: string; textBody?: string }> = [];
    const repo = new InMemoryAuthUserRepository([
      {
        id: 'user-google-delete-1',
        email: 'google-delete@example.com',
        fullName: 'Google Delete',
        passwordHash: null,
        googleSubject: 'google-delete-subject',
        isActive: true,
        planSelectionCompleted: true,
        createdAt: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-05-01T00:00:00.000Z'),
      },
    ]);
    const authService = new AuthService({
      userStore: repo,
      now: () => new Date('2026-05-04T12:00:00.000Z'),
      emailService: {
        async send(notification) {
          sentEmails.push(notification);
        },
      },
    });
    const controller = new AuthController(authService, createSessionCookieOptions({ NODE_ENV: 'test' }));
    const session = {
      adminUser: {
        email: 'google-delete@example.com',
        needsPlanSelection: false,
      },
    } as any;

    const rejectedResponse = await controller.requestAccountDeletion({ session });
    expect(rejectedResponse.status).toBe(401);

    const challengeResponse = await controller.sendAccountDeletionConfirmation({ session });
    expect(challengeResponse.status).toBe(200);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe('google-delete@example.com');
    const code = sentEmails[0].textBody?.match(/\b\d{6}\b/)?.[0] ?? '';
    expect(code).toMatch(/^\d{6}$/);

    const response = await controller.requestAccountDeletion({
      session,
      body: {
        confirmationCode: code,
      },
    });

    expect(response.status).toBe(200);
    expect(response.body.accountDeletion?.status).toBe('pending_deactivation');
  });
});
