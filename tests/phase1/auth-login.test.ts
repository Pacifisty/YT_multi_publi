import { describe, expect, test } from 'vitest';

import { AuthController } from '../../apps/api/src/auth/auth.controller';
import { AuthService } from '../../apps/api/src/auth/auth.service';
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
    expect(response.body.user.email).toBe('admin@example.com');
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
