import { afterEach, describe, expect, test, vi } from 'vitest';
import { bootstrap } from '../../apps/api/src/bootstrap';
import { createHealthCheck } from '../../apps/api/src/health';

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

describe('health check database status', () => {
  let cleanup: (() => Promise<void>) | null = null;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = null;
    }
  });

  test('createHealthCheck includes database metadata when provided', () => {
    const health = createHealthCheck({
      nodeEnv: 'test',
      getDatabaseStatus: () => ({
        configured: true,
        connected: false,
        mode: 'prisma',
      }),
    });

    const result = health.check();

    expect(result.database).toEqual({
      configured: true,
      connected: false,
      mode: 'prisma',
    });
  });

  test('bootstrap health reports prisma mode when DATABASE_URL and Prisma runtime are available', () => {
    const result = bootstrap({ env: baseEnv });

    const health = result.healthCheck.handleRequest();

    expect(health.body.database).toEqual({
      configured: true,
      connected: false,
      mode: 'prisma',
    });
  });

  test('startServer health reports prisma mode after database connect', async () => {
    const { startServer } = await import('../../apps/api/src/start');

    const fakePrisma = {
      $connect: vi.fn().mockResolvedValue(undefined),
      $disconnect: vi.fn().mockResolvedValue(undefined),
      campaign: {
        create: vi.fn(async ({ data }: any) => data),
        findUnique: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        update: vi.fn(async () => null),
        delete: vi.fn(async () => null),
      },
      campaignTarget: {
        create: vi.fn(async ({ data }: any) => data),
        delete: vi.fn(async () => null),
        update: vi.fn(async () => null),
      },
      publishJob: {
        create: vi.fn(async ({ data }: any) => data),
        findUnique: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        update: vi.fn(async () => null),
        delete: vi.fn(async () => null),
      },
      connectedAccount: {
        create: vi.fn(async ({ data }: any) => data),
        findUnique: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        update: vi.fn(async () => null),
        delete: vi.fn(async () => null),
      },
      youTubeChannel: {
        create: vi.fn(async ({ data }: any) => data),
        findUnique: vi.fn(async () => null),
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        update: vi.fn(async () => null),
        delete: vi.fn(async () => null),
      },
      mediaAsset: {
        create: vi.fn(async ({ data }: any) => data),
        findUnique: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        update: vi.fn(async () => null),
        delete: vi.fn(async () => null),
      },
    };

    const instance = await startServer({
      env: baseEnv,
      port: 0,
      _prismaFactory: () => fakePrisma,
    });
    cleanup = instance.shutdown;

    const response = await fetch(`http://127.0.0.1:${instance.port}/health`);
    const body = await response.json();

    expect(body.database).toEqual({
      configured: true,
      connected: true,
      mode: 'prisma',
    });
  });
});
