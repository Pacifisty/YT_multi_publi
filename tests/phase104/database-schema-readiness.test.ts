import { describe, expect, test, vi } from 'vitest';
import { createDatabaseProvider } from '../../apps/api/src/config/database-provider';

const databaseUrl = 'postgresql://localhost:5432/test';

function createSchemaAwarePrisma(existingTables: string[]) {
  return {
    $connect: vi.fn().mockResolvedValue(undefined),
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $queryRawUnsafe: vi
      .fn()
      .mockResolvedValue(existingTables.map((table_name) => ({ table_name }))),
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
    auditEvent: {
      create: vi.fn(async ({ data }: any) => data),
      findMany: vi.fn(async () => []),
    },
  };
}

describe('database schema readiness', () => {
  test('connect succeeds when required Prisma tables exist', async () => {
    const prisma = createSchemaAwarePrisma([
      'admin_users',
      'connected_accounts',
      'youtube_channels',
      'media_assets',
      'campaigns',
      'campaign_targets',
      'publish_jobs',
      'audit_events',
    ]);

    const provider = createDatabaseProvider({
      databaseUrl,
      _prismaFactory: () => prisma,
    });

    await provider.connect();

    expect(prisma.$connect).toHaveBeenCalledOnce();
    expect(prisma.$queryRawUnsafe).toHaveBeenCalledOnce();
    expect(provider.isConnected()).toBe(true);
  });

  test('connect fails fast and disconnects when required Prisma tables are missing', async () => {
    const prisma = createSchemaAwarePrisma([
      'admin_users',
      'connected_accounts',
      'youtube_channels',
      'media_assets',
      'campaigns',
      'campaign_targets',
    ]);

    const provider = createDatabaseProvider({
      databaseUrl,
      _prismaFactory: () => prisma,
    });

    await expect(provider.connect()).rejects.toThrow(
      'Database schema is missing required tables: publish_jobs, audit_events. Run Prisma migrations before starting the server.',
    );

    expect(prisma.$connect).toHaveBeenCalledOnce();
    expect(prisma.$disconnect).toHaveBeenCalledOnce();
    expect(provider.isConnected()).toBe(false);
  });
});
