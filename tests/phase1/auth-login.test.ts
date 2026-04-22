import { describe, expect, test } from 'vitest';

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
