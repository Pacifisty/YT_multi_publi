import { describe, expect, test, vi } from 'vitest';

async function hasPrismaClientInstalled(): Promise<boolean> {
  try {
    await import('@prisma/client');
    return true;
  } catch {
    return false;
  }
}

// ── Prisma Connected Account Repository ──────────────────────────────────────

describe('PrismaConnectedAccountRepository', () => {
  async function loadRepo() {
    const { PrismaConnectedAccountRepository } = await import(
      '../../apps/api/src/accounts/prisma-connected-account.repository'
    );
    return PrismaConnectedAccountRepository;
  }

  function makePrisma() {
    return {
      connectedAccount: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
  }

  test('create — maps DTO to Prisma call and returns ConnectedAccount', async () => {
    const Repo = await loadRepo();
    const prisma = makePrisma();
    const now = new Date('2025-06-01T00:00:00Z');

    prisma.connectedAccount.create.mockResolvedValue({
      id: 'ca-1',
      provider: 'google',
      email: 'user@example.com',
      displayName: 'User',
      accessTokenEnc: 'enc-access',
      refreshTokenEnc: 'enc-refresh',
      scopes: ['youtube.upload'],
      tokenExpiresAt: now,
      status: 'connected',
      connectedAt: now,
      updatedAt: now,
    });

    const repo = new Repo(prisma as any);
    const result = await repo.create({
      provider: 'google',
      email: 'user@example.com',
      displayName: 'User',
      accessTokenEnc: 'enc-access',
      refreshTokenEnc: 'enc-refresh',
      scopes: ['youtube.upload'],
      tokenExpiresAt: now,
    });

    expect(result.id).toBe('ca-1');
    expect(result.provider).toBe('google');
    expect(result.email).toBe('user@example.com');
    expect(result.status).toBe('connected');
    expect(result.connectedAt).toBeInstanceOf(Date);
    expect(prisma.connectedAccount.create).toHaveBeenCalledOnce();
  });

  test('findById — returns mapped record or null', async () => {
    const Repo = await loadRepo();
    const prisma = makePrisma();
    const now = new Date('2025-06-01T00:00:00Z');

    prisma.connectedAccount.findUnique.mockResolvedValue({
      id: 'ca-1',
      provider: 'google',
      email: 'user@example.com',
      displayName: 'User',
      accessTokenEnc: 'enc-access',
      refreshTokenEnc: null,
      scopes: [],
      tokenExpiresAt: null,
      status: 'connected',
      connectedAt: now,
      updatedAt: now,
    });

    const repo = new Repo(prisma as any);
    const found = await repo.findById('ca-1');
    expect(found).not.toBeNull();
    expect(found!.id).toBe('ca-1');

    prisma.connectedAccount.findUnique.mockResolvedValue(null);
    const notFound = await repo.findById('nonexistent');
    expect(notFound).toBeNull();
  });

  test('findAll — returns all mapped records', async () => {
    const Repo = await loadRepo();
    const prisma = makePrisma();
    const now = new Date();

    prisma.connectedAccount.findMany.mockResolvedValue([
      {
        id: 'ca-1',
        provider: 'google',
        email: 'a@b.com',
        displayName: null,
        accessTokenEnc: 'enc',
        refreshTokenEnc: null,
        scopes: [],
        tokenExpiresAt: null,
        status: 'connected',
        connectedAt: now,
        updatedAt: now,
      },
      {
        id: 'ca-2',
        provider: 'google',
        email: 'c@d.com',
        displayName: null,
        accessTokenEnc: 'enc2',
        refreshTokenEnc: null,
        scopes: [],
        tokenExpiresAt: null,
        status: 'connected',
        connectedAt: now,
        updatedAt: now,
      },
    ]);

    const repo = new Repo(prisma as any);
    const results = await repo.findAll();
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('ca-1');
    expect(results[1].id).toBe('ca-2');
  });

  test('findByProvider — filters by provider', async () => {
    const Repo = await loadRepo();
    const prisma = makePrisma();

    prisma.connectedAccount.findMany.mockResolvedValue([]);

    const repo = new Repo(prisma as any);
    const results = await repo.findByProvider('google');
    expect(results).toHaveLength(0);
    expect(prisma.connectedAccount.findMany).toHaveBeenCalledWith({
      where: { provider: 'google' },
    });
  });

  test('update — maps partial data and returns updated record', async () => {
    const Repo = await loadRepo();
    const prisma = makePrisma();
    const now = new Date();

    prisma.connectedAccount.update.mockResolvedValue({
      id: 'ca-1',
      provider: 'google',
      email: 'new@email.com',
      displayName: null,
      accessTokenEnc: 'enc',
      refreshTokenEnc: null,
      scopes: [],
      tokenExpiresAt: null,
      status: 'disconnected',
      connectedAt: now,
      updatedAt: now,
    });

    const repo = new Repo(prisma as any);
    const result = await repo.update('ca-1', { status: 'disconnected' });
    expect(result).not.toBeNull();
    expect(result!.status).toBe('disconnected');
    expect(prisma.connectedAccount.update).toHaveBeenCalledWith({
      where: { id: 'ca-1' },
      data: { status: 'disconnected' },
    });
  });

  test('update — returns null when record not found', async () => {
    const Repo = await loadRepo();
    const prisma = makePrisma();

    prisma.connectedAccount.update.mockRejectedValue(
      Object.assign(new Error('Record not found'), { code: 'P2025' }),
    );

    const repo = new Repo(prisma as any);
    const result = await repo.update('nonexistent', { status: 'disconnected' });
    expect(result).toBeNull();
  });

  test('delete — returns true on success, false on not found', async () => {
    const Repo = await loadRepo();
    const prisma = makePrisma();

    prisma.connectedAccount.delete.mockResolvedValue({ id: 'ca-1' });
    const repo = new Repo(prisma as any);
    expect(await repo.delete('ca-1')).toBe(true);

    prisma.connectedAccount.delete.mockRejectedValue(
      Object.assign(new Error('Record not found'), { code: 'P2025' }),
    );
    expect(await repo.delete('nonexistent')).toBe(false);
  });
});

// ── Prisma YouTube Channel Repository ────────────────────────────────────────

describe('PrismaYouTubeChannelRepository', () => {
  async function loadRepo() {
    const { PrismaYouTubeChannelRepository } = await import(
      '../../apps/api/src/channels/prisma-youtube-channel.repository'
    );
    return PrismaYouTubeChannelRepository;
  }

  function makePrisma() {
    return {
      youTubeChannel: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
  }

  const NOW = new Date('2025-06-01T00:00:00Z');

  function channelRow(overrides: Record<string, any> = {}) {
    return {
      id: 'ch-1',
      connectedAccountId: 'ca-1',
      youtubeChannelId: 'UC_abc',
      title: 'My Channel',
      handle: '@mychannel',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      isActive: true,
      lastSyncedAt: NOW,
      ...overrides,
    };
  }

  test('create — maps DTO to Prisma call and returns YouTubeChannel', async () => {
    const Repo = await loadRepo();
    const prisma = makePrisma();

    prisma.youTubeChannel.create.mockResolvedValue(channelRow());

    const repo = new Repo(prisma as any);
    const result = await repo.create({
      connectedAccountId: 'ca-1',
      youtubeChannelId: 'UC_abc',
      title: 'My Channel',
      handle: '@mychannel',
      thumbnailUrl: 'https://example.com/thumb.jpg',
    });

    expect(result.id).toBe('ch-1');
    expect(result.connectedAccountId).toBe('ca-1');
    expect(result.youtubeChannelId).toBe('UC_abc');
    expect(result.title).toBe('My Channel');
    expect(result.isActive).toBe(true);
    expect(result.lastSyncedAt).toBeInstanceOf(Date);
    expect(prisma.youTubeChannel.create).toHaveBeenCalledOnce();
  });

  test('findById — returns mapped record or null', async () => {
    const Repo = await loadRepo();
    const prisma = makePrisma();

    prisma.youTubeChannel.findUnique.mockResolvedValue(channelRow());

    const repo = new Repo(prisma as any);
    const found = await repo.findById('ch-1');
    expect(found).not.toBeNull();
    expect(found!.title).toBe('My Channel');

    prisma.youTubeChannel.findUnique.mockResolvedValue(null);
    expect(await repo.findById('nope')).toBeNull();
  });

  test('findByAccountAndChannelId — uses compound lookup', async () => {
    const Repo = await loadRepo();
    const prisma = makePrisma();

    prisma.youTubeChannel.findFirst.mockResolvedValue(channelRow());

    const repo = new Repo(prisma as any);
    const found = await repo.findByAccountAndChannelId('ca-1', 'UC_abc');
    expect(found).not.toBeNull();
    expect(prisma.youTubeChannel.findFirst).toHaveBeenCalledWith({
      where: { connectedAccountId: 'ca-1', youtubeChannelId: 'UC_abc' },
    });
  });

  test('findByAccount — returns channels for account', async () => {
    const Repo = await loadRepo();
    const prisma = makePrisma();

    prisma.youTubeChannel.findMany.mockResolvedValue([channelRow(), channelRow({ id: 'ch-2' })]);

    const repo = new Repo(prisma as any);
    const results = await repo.findByAccount('ca-1');
    expect(results).toHaveLength(2);
    expect(prisma.youTubeChannel.findMany).toHaveBeenCalledWith({
      where: { connectedAccountId: 'ca-1' },
    });
  });

  test('findActive — returns only active channels', async () => {
    const Repo = await loadRepo();
    const prisma = makePrisma();

    prisma.youTubeChannel.findMany.mockResolvedValue([channelRow()]);

    const repo = new Repo(prisma as any);
    const results = await repo.findActive();
    expect(results).toHaveLength(1);
    expect(prisma.youTubeChannel.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
    });
  });

  test('update — maps partial data and returns updated record', async () => {
    const Repo = await loadRepo();
    const prisma = makePrisma();

    prisma.youTubeChannel.update.mockResolvedValue(channelRow({ isActive: false }));

    const repo = new Repo(prisma as any);
    const result = await repo.update('ch-1', { isActive: false });
    expect(result).not.toBeNull();
    expect(result!.isActive).toBe(false);
  });

  test('update — returns null when record not found', async () => {
    const Repo = await loadRepo();
    const prisma = makePrisma();

    prisma.youTubeChannel.update.mockRejectedValue(
      Object.assign(new Error('Record not found'), { code: 'P2025' }),
    );

    const repo = new Repo(prisma as any);
    const result = await repo.update('nonexistent', { isActive: false });
    expect(result).toBeNull();
  });

  test('delete — returns true on success, false on not found', async () => {
    const Repo = await loadRepo();
    const prisma = makePrisma();

    prisma.youTubeChannel.delete.mockResolvedValue({ id: 'ch-1' });
    const repo = new Repo(prisma as any);
    expect(await repo.delete('ch-1')).toBe(true);

    prisma.youTubeChannel.delete.mockRejectedValue(
      Object.assign(new Error('Record not found'), { code: 'P2025' }),
    );
    expect(await repo.delete('nonexistent')).toBe(false);
  });
});

// ── Database Provider Wiring ─────────────────────────────────────────────────

describe('database-provider wiring for accounts + channels', () => {
  test('exposes connectedAccountRepository when _prismaFactory provided', async () => {
    const { createDatabaseProvider } = await import(
      '../../apps/api/src/config/database-provider'
    );

    const fakePrisma = { $connect: vi.fn(), $disconnect: vi.fn() };
    const provider = createDatabaseProvider({
      databaseUrl: 'postgresql://localhost/test',
      _prismaFactory: () => fakePrisma,
    });

    expect(provider.connectedAccountRepository).not.toBeNull();
  });

  test('exposes youtubeChannelRepository when _prismaFactory provided', async () => {
    const { createDatabaseProvider } = await import(
      '../../apps/api/src/config/database-provider'
    );

    const fakePrisma = { $connect: vi.fn(), $disconnect: vi.fn() };
    const provider = createDatabaseProvider({
      databaseUrl: 'postgresql://localhost/test',
      _prismaFactory: () => fakePrisma,
    });

    expect(provider.youtubeChannelRepository).not.toBeNull();
  });

  test('repos are null when no _prismaFactory given', async () => {
    const { createDatabaseProvider } = await import(
      '../../apps/api/src/config/database-provider'
    );

    const provider = createDatabaseProvider({ databaseUrl: 'postgresql://localhost/test' });
    const hasPrisma = await hasPrismaClientInstalled();

    if (hasPrisma) {
      expect(provider.connectedAccountRepository).not.toBeNull();
      expect(provider.youtubeChannelRepository).not.toBeNull();
      return;
    }

    expect(provider.connectedAccountRepository).toBeNull();
    expect(provider.youtubeChannelRepository).toBeNull();
  });
});

// ── Bootstrap Wiring ─────────────────────────────────────────────────────────

describe('bootstrap passes account + channel repos through', () => {
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

  test('bootstrap creates connectedAccountRepository from _prismaFactory', async () => {
    const { bootstrap } = await import('../../apps/api/src/bootstrap');

    const fakePrisma = { $connect: vi.fn(), $disconnect: vi.fn() };
    const result = bootstrap({
      env: baseEnv,
      _prismaFactory: () => fakePrisma,
    });

    expect(result.databaseProvider.connectedAccountRepository).not.toBeNull();
  });

  test('bootstrap creates youtubeChannelRepository from _prismaFactory', async () => {
    const { bootstrap } = await import('../../apps/api/src/bootstrap');

    const fakePrisma = { $connect: vi.fn(), $disconnect: vi.fn() };
    const result = bootstrap({
      env: baseEnv,
      _prismaFactory: () => fakePrisma,
    });

    expect(result.databaseProvider.youtubeChannelRepository).not.toBeNull();
  });

  test('without _prismaFactory, account + channel repos are null', async () => {
    const { bootstrap } = await import('../../apps/api/src/bootstrap');

    const result = bootstrap({ env: baseEnv });
    const hasPrisma = await hasPrismaClientInstalled();

    if (hasPrisma) {
      expect(result.databaseProvider.connectedAccountRepository).not.toBeNull();
      expect(result.databaseProvider.youtubeChannelRepository).not.toBeNull();
      return;
    }

    expect(result.databaseProvider.connectedAccountRepository).toBeNull();
    expect(result.databaseProvider.youtubeChannelRepository).toBeNull();
  });
});
