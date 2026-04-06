import { describe, it, expect, vi } from 'vitest';
import { bootstrap } from '../../apps/api/src/bootstrap';
import { createChannelRepoAdapter } from '../../apps/api/src/config/channel-repo-adapter';
import type { YouTubeChannelRepository, YouTubeChannel } from '../../apps/api/src/channels/youtube-channel.service';

const baseEnv = {
  OAUTH_TOKEN_KEY: 'a]3Fk9$2mP!xL7nQ&vR4wY6zA0cE8gI5',
  NODE_ENV: 'development',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_PASSWORD_HASH: 'plain:secret123',
  DATABASE_URL: 'postgresql://localhost:5432/test',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/auth/callback',
};

const testChannel: YouTubeChannel = {
  id: 'ch-1',
  connectedAccountId: 'acc-1',
  youtubeChannelId: 'UC_test',
  title: 'Test Channel',
  handle: '@testchannel',
  thumbnailUrl: 'https://example.com/thumb.jpg',
  isActive: true,
  lastSyncedAt: new Date('2024-06-01T12:00:00Z'),
};

function makeMockRepo(overrides: Partial<YouTubeChannelRepository> = {}): YouTubeChannelRepository {
  return {
    create: vi.fn(async (dto) => ({
      id: 'ch-new',
      connectedAccountId: dto.connectedAccountId,
      youtubeChannelId: dto.youtubeChannelId,
      title: dto.title,
      handle: dto.handle ?? null,
      thumbnailUrl: dto.thumbnailUrl ?? null,
      isActive: true,
      lastSyncedAt: new Date(),
    })),
    findById: vi.fn(async () => null),
    findByAccountAndChannelId: vi.fn(async () => null),
    findByAccount: vi.fn(async () => []),
    findActive: vi.fn(async () => []),
    update: vi.fn(async () => null),
    delete: vi.fn(async () => false),
    ...overrides,
  };
}

// ── Adapter unit tests ──

describe('createChannelRepoAdapter', () => {
  it('findByAccountId delegates to repo.findByAccount and adapts results', async () => {
    const repo = makeMockRepo({ findByAccount: vi.fn(async () => [testChannel]) });
    const adapter = createChannelRepoAdapter(repo);

    const results = await adapter.findByAccountId('acc-1');

    expect(repo.findByAccount).toHaveBeenCalledWith('acc-1');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('ch-1');
    expect(results[0].lastSyncedAt).toBe('2024-06-01T12:00:00.000Z');
    expect(results[0].handle).toBe('@testchannel');
  });

  it('findById delegates and adapts result', async () => {
    const repo = makeMockRepo({ findById: vi.fn(async () => testChannel) });
    const adapter = createChannelRepoAdapter(repo);

    const result = await adapter.findById('ch-1');

    expect(repo.findById).toHaveBeenCalledWith('ch-1');
    expect(result).not.toBeNull();
    expect(result!.youtubeChannelId).toBe('UC_test');
  });

  it('findById returns null when not found', async () => {
    const repo = makeMockRepo();
    const adapter = createChannelRepoAdapter(repo);

    const result = await adapter.findById('nonexistent');
    expect(result).toBeNull();
  });

  it('update delegates with adapted partial data', async () => {
    const updatedChannel = { ...testChannel, isActive: false };
    const repo = makeMockRepo({ update: vi.fn(async () => updatedChannel) });
    const adapter = createChannelRepoAdapter(repo);

    const result = await adapter.update('ch-1', { isActive: false });

    expect(repo.update).toHaveBeenCalledWith('ch-1', expect.objectContaining({ isActive: false }));
    expect(result).not.toBeNull();
    expect(result!.isActive).toBe(false);
  });

  it('update returns null when channel not found', async () => {
    const repo = makeMockRepo({ update: vi.fn(async () => null) });
    const adapter = createChannelRepoAdapter(repo);

    const result = await adapter.update('nonexistent', { isActive: false });
    expect(result).toBeNull();
  });

  it('upsert creates new channel when not found', async () => {
    const repo = makeMockRepo({
      findByAccountAndChannelId: vi.fn(async () => null),
    });
    const adapter = createChannelRepoAdapter(repo);

    const record = {
      id: 'ch-temp',
      connectedAccountId: 'acc-1',
      youtubeChannelId: 'UC_new',
      title: 'New Channel',
      handle: '@new',
      thumbnailUrl: 'https://example.com/new.jpg',
      isActive: true,
      lastSyncedAt: new Date().toISOString(),
    };

    const result = await adapter.upsert(record);

    expect(repo.findByAccountAndChannelId).toHaveBeenCalledWith('acc-1', 'UC_new');
    expect(repo.create).toHaveBeenCalled();
    expect(result.connectedAccountId).toBe('acc-1');
  });

  it('upsert updates existing channel when found', async () => {
    const updatedChannel = { ...testChannel, title: 'Updated Title' };
    const repo = makeMockRepo({
      findByAccountAndChannelId: vi.fn(async () => testChannel),
      update: vi.fn(async () => updatedChannel),
    });
    const adapter = createChannelRepoAdapter(repo);

    const record = {
      id: 'ch-temp',
      connectedAccountId: 'acc-1',
      youtubeChannelId: 'UC_test',
      title: 'Updated Title',
      isActive: true,
      lastSyncedAt: new Date().toISOString(),
    };

    const result = await adapter.upsert(record);

    expect(repo.findByAccountAndChannelId).toHaveBeenCalledWith('acc-1', 'UC_test');
    expect(repo.update).toHaveBeenCalledWith('ch-1', expect.objectContaining({ title: 'Updated Title' }));
    expect(repo.create).not.toHaveBeenCalled();
    expect(result.title).toBe('Updated Title');
  });

  it('deactivateAllForAccount finds and deactivates all channels', async () => {
    const channel2: YouTubeChannel = { ...testChannel, id: 'ch-2', youtubeChannelId: 'UC_test2' };
    const repo = makeMockRepo({
      findByAccount: vi.fn(async () => [testChannel, channel2]),
      update: vi.fn(async (id, data) => ({ ...testChannel, id, ...data })),
    });
    const adapter = createChannelRepoAdapter(repo);

    await adapter.deactivateAllForAccount('acc-1');

    expect(repo.findByAccount).toHaveBeenCalledWith('acc-1');
    expect(repo.update).toHaveBeenCalledTimes(2);
    expect(repo.update).toHaveBeenCalledWith('ch-1', { isActive: false });
    expect(repo.update).toHaveBeenCalledWith('ch-2', { isActive: false });
  });

  it('converts null handle/thumbnailUrl to undefined in ChannelRecord', async () => {
    const channelWithNulls: YouTubeChannel = {
      ...testChannel,
      handle: null,
      thumbnailUrl: null,
    };
    const repo = makeMockRepo({ findById: vi.fn(async () => channelWithNulls) });
    const adapter = createChannelRepoAdapter(repo);

    const result = await adapter.findById('ch-1');

    expect(result!.handle).toBeUndefined();
    expect(result!.thumbnailUrl).toBeUndefined();
  });
});

// ── Bootstrap wiring integration tests ──

describe('Bootstrap wires Prisma channel repo', () => {
  function makeMockPrisma(seedChannels: any[] = []) {
    const channels = [...seedChannels];
    return {
      $connect: vi.fn(),
      $disconnect: vi.fn(),
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
        create: vi.fn(async ({ data }: any) => {
          channels.push(data);
          return data;
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          return channels.find((c: any) => c.id === where.id) ?? null;
        }),
        findFirst: vi.fn(async ({ where }: any) => {
          return channels.find((c: any) =>
            c.connectedAccountId === where.connectedAccountId &&
            c.youtubeChannelId === where.youtubeChannelId,
          ) ?? null;
        }),
        findMany: vi.fn(async ({ where }: any) => {
          if (!where) return [...channels];
          return channels.filter((c: any) => {
            if (where.connectedAccountId && c.connectedAccountId !== where.connectedAccountId) return false;
            if (where.isActive !== undefined && c.isActive !== where.isActive) return false;
            return true;
          });
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const c = channels.find((c: any) => c.id === where.id);
          if (!c) throw { code: 'P2025' };
          Object.assign(c, data);
          return { ...c };
        }),
        delete: vi.fn(async ({ where }: any) => {
          const idx = channels.findIndex((c: any) => c.id === where.id);
          if (idx === -1) throw { code: 'P2025' };
          return channels.splice(idx, 1)[0];
        }),
      },
      mediaAsset: {
        create: vi.fn(async ({ data }: any) => data),
        findUnique: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        update: vi.fn(async () => null),
        delete: vi.fn(async () => null),
      },
    };
  }

  it('getChannelsForAccount returns Prisma-backed channels through bootstrap', async () => {
    const seedChannel = {
      id: 'ch-1',
      connectedAccountId: 'acc-1',
      youtubeChannelId: 'UC_test',
      title: 'Test Channel',
      handle: '@test',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      isActive: true,
      lastSyncedAt: new Date('2024-06-01T12:00:00Z'),
    };
    const mockPrisma = makeMockPrisma([seedChannel]);

    const result = bootstrap({
      env: baseEnv,
      _prismaFactory: () => mockPrisma,
    });

    const channels = await result.server.app.accountsModule.accountsService.getChannelsForAccount('acc-1');
    expect(channels).toHaveLength(1);
    expect(channels[0].id).toBe('ch-1');
    expect(channels[0].title).toBe('Test Channel');
    expect(mockPrisma.youTubeChannel.findMany).toHaveBeenCalled();
  });

  it('toggleChannel returns Prisma-backed updated channel through bootstrap', async () => {
    const seedChannel = {
      id: 'ch-1',
      connectedAccountId: 'acc-1',
      youtubeChannelId: 'UC_test',
      title: 'Test Channel',
      handle: '@test',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      isActive: true,
      lastSyncedAt: new Date('2024-06-01T12:00:00Z'),
    };
    const mockPrisma = makeMockPrisma([seedChannel]);

    const result = bootstrap({
      env: baseEnv,
      _prismaFactory: () => mockPrisma,
    });

    const toggled = await result.server.app.accountsModule.accountsService.toggleChannel('ch-1', false);
    expect(toggled).not.toBeNull();
    expect(toggled!.isActive).toBe(false);
    expect(mockPrisma.youTubeChannel.update).toHaveBeenCalled();
  });
});
