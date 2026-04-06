import { afterEach, describe, expect, test, vi } from 'vitest';
import { createDatabaseProvider } from '../../apps/api/src/config/database-provider';

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

function createFakePrismaModule() {
  const connect = vi.fn().mockResolvedValue(undefined);
  const disconnect = vi.fn().mockResolvedValue(undefined);

  const prisma = {
    $connect: connect,
    $disconnect: disconnect,
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

  const PrismaClient = vi.fn(function FakePrismaClient() {
    return prisma;
  });

  return {
    PrismaClient,
    prisma,
    connect,
    disconnect,
  };
}

describe('default Prisma runtime wiring', () => {
  test('createDatabaseProvider builds repositories from a PrismaClient module without _prismaFactory', () => {
    const { PrismaClient } = createFakePrismaModule();

    const provider = createDatabaseProvider({
      databaseUrl: baseEnv.DATABASE_URL,
      _prismaModule: { PrismaClient },
    } as any);

    expect(PrismaClient).toHaveBeenCalledWith({
      datasources: {
        db: {
          url: baseEnv.DATABASE_URL,
        },
      },
    });
    expect(provider.campaignRepository).not.toBeNull();
    expect(provider.publishJobRepository).not.toBeNull();
    expect(provider.connectedAccountRepository).not.toBeNull();
    expect(provider.youtubeChannelRepository).not.toBeNull();
    expect(provider.mediaAssetRepository).not.toBeNull();
  });

  test('startServer connects and disconnects through the default Prisma module path', async () => {
    const { startServer } = await import('../../apps/api/src/start');
    const { PrismaClient, connect, disconnect } = createFakePrismaModule();

    const instance = await startServer({
      env: baseEnv,
      port: 0,
      _prismaModule: { PrismaClient },
    } as any);

    expect(connect).toHaveBeenCalledOnce();

    await instance.shutdown();

    expect(disconnect).toHaveBeenCalledOnce();
  });
});
