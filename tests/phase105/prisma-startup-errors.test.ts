import { describe, expect, test } from 'vitest';
import { bootstrap } from '../../apps/api/src/bootstrap';
import { formatStartupError } from '../../apps/api/src/cli';

const baseEnv: Record<string, string> = {
  NODE_ENV: 'test',
  SESSION_SECRET: 'test-session-secret-32-chars-min!!',
  OAUTH_TOKEN_KEY: '12345678901234567890123456789012',
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/callback',
  DATABASE_URL: 'postgresql://localhost/test',
  ADMIN_EMAIL: 'admin@test.com',
  ADMIN_PASSWORD_HASH: '$2b$10$fakehash',
};

describe('Prisma startup errors', () => {
  test('bootstrap health reports prisma mode when DATABASE_URL is set even if Prisma client is unavailable', () => {
    const result = bootstrap({
      env: baseEnv,
      _prismaFactory: () => null,
    });

    const health = result.healthCheck.handleRequest();
    const ready = result.healthCheck.handleReadyRequest();

    expect(health.body.database).toEqual({
      configured: true,
      connected: false,
      mode: 'prisma',
    });
    expect(ready.status).toBe(503);
    expect(ready.body.ready).toBe(false);
  });

  test('startServer fails fast when DATABASE_URL is set but Prisma client cannot be created', async () => {
    const { startServer } = await import('../../apps/api/src/start');

    await expect(
      startServer({
        env: baseEnv,
        port: 0,
        _prismaFactory: () => null,
      }),
    ).rejects.toThrow(
      'DATABASE_URL is configured, but Prisma Client is not available. Install dependencies and run Prisma generate before starting the server.',
    );
  });

  test('formatStartupError adds a Prisma generate hint for missing Prisma client', () => {
    const lines = formatStartupError(
      new Error(
        'DATABASE_URL is configured, but Prisma Client is not available. Install dependencies and run Prisma generate before starting the server.',
      ),
    );

    expect(lines).toEqual([
      '[api] failed to start',
      '[api] DATABASE_URL is configured, but Prisma Client is not available. Install dependencies and run Prisma generate before starting the server.',
      '[api] Fix: run `npm install` and `npm run db:generate`, then start the server again.',
    ]);
  });

  test('formatStartupError adds a migration hint for missing tables', () => {
    const lines = formatStartupError(
      new Error(
        'Database schema is missing required tables: publish_jobs, audit_events. Run Prisma migrations before starting the server.',
      ),
    );

    expect(lines).toEqual([
      '[api] failed to start',
      '[api] Database schema is missing required tables: publish_jobs, audit_events. Run Prisma migrations before starting the server.',
      '[api] Fix: run `npm run db:deploy` against the configured database, then start the server again.',
    ]);
  });
});
