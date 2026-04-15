import { afterEach, describe, expect, test, vi } from 'vitest';

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

function createFakePrisma(disconnectFn = vi.fn().mockResolvedValue(undefined)) {
  return {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: disconnectFn,
    campaign: { create: vi.fn(async ({ data }: any) => data), findUnique: vi.fn(async () => null), findMany: vi.fn(async () => []), update: vi.fn(async () => null), delete: vi.fn(async () => null) },
    campaignTarget: { create: vi.fn(async ({ data }: any) => data), delete: vi.fn(async () => null), update: vi.fn(async () => null) },
    publishJob: { create: vi.fn(async ({ data }: any) => data), findUnique: vi.fn(async () => null), findMany: vi.fn(async () => []), update: vi.fn(async () => null), delete: vi.fn(async () => null) },
    connectedAccount: { create: vi.fn(async ({ data }: any) => data), findUnique: vi.fn(async () => null), findMany: vi.fn(async () => []), update: vi.fn(async () => null), delete: vi.fn(async () => null) },
    youTubeChannel: { create: vi.fn(async ({ data }: any) => data), findUnique: vi.fn(async () => null), findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []), update: vi.fn(async () => null), delete: vi.fn(async () => null) },
    mediaAsset: { create: vi.fn(async ({ data }: any) => data), findUnique: vi.fn(async () => null), findMany: vi.fn(async () => []), update: vi.fn(async () => null), delete: vi.fn(async () => null) },
  };
}

describe('startServer listen failure cleanup', () => {
  let cleanup: (() => Promise<void>) | null = null;
  const inMemoryEnv = {
    ...baseEnv,
    DATABASE_URL: '',
  };

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = null;
    }
    vi.restoreAllMocks();
  });

  test('disconnects the database if HTTP listen fails after connect', async () => {
    const { startServer } = await import('../../apps/api/src/start');

    const running = await startServer({ env: inMemoryEnv, port: 0 });
    cleanup = running.shutdown;

    const disconnectFn = vi.fn().mockResolvedValue(undefined);
    const fakePrisma = createFakePrisma(disconnectFn);

    await expect(
      startServer({
        env: baseEnv,
        port: running.port,
        _prismaFactory: () => fakePrisma,
      }),
    ).rejects.toThrow();

    expect(disconnectFn).toHaveBeenCalledTimes(1);
  });

  test('disconnects the database on listen failure when using the Prisma module path', async () => {
    const { startServer } = await import('../../apps/api/src/start');

    const running = await startServer({ env: inMemoryEnv, port: 0 });
    cleanup = running.shutdown;

    const disconnectFn = vi.fn().mockResolvedValue(undefined);
    const PrismaClient = vi.fn(function FakePrismaClient() {
      return createFakePrisma(disconnectFn);
    });

    await expect(
      startServer({
        env: baseEnv,
        port: running.port,
        _prismaModule: { PrismaClient },
      } as any),
    ).rejects.toThrow();

    expect(disconnectFn).toHaveBeenCalledTimes(1);
  });
});
