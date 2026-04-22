import { describe, it, expect, vi } from 'vitest';
import { bootstrap } from '../../apps/api/src/bootstrap';
import { createMediaRepoAdapter } from '../../apps/api/src/config/media-repo-adapter';
import { MediaService, type MediaRepository, type MediaServiceOptions } from '../../apps/api/src/media/media.service';
import { MediaController } from '../../apps/api/src/media/media.controller';
import { SessionGuard } from '../../apps/api/src/auth/session.guard';
import type { MediaAssetRepository, MediaAsset, MediaAssetType } from '../../apps/api/src/media/media-asset.service';

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

const testAsset: MediaAsset = {
  id: 'asset-1',
  assetType: 'video',
  originalName: 'test-video.mp4',
  storagePath: '/storage/test-video.mp4',
  sizeBytes: 1024000,
  mimeType: 'video/mp4',
  durationSeconds: 120,
  linkedVideoAssetId: null,
  createdAt: new Date('2024-06-01T12:00:00Z'),
};

const testThumbnail: MediaAsset = {
  id: 'thumb-1',
  assetType: 'thumbnail',
  originalName: 'thumb.jpg',
  storagePath: '/storage/thumb.jpg',
  sizeBytes: 50000,
  mimeType: 'image/jpeg',
  durationSeconds: 0,
  linkedVideoAssetId: 'asset-1',
  createdAt: new Date('2024-06-01T12:00:00Z'),
};

function makeMockAssetRepo(overrides: Partial<MediaAssetRepository> = {}): MediaAssetRepository {
  return {
    create: vi.fn(async () => testAsset),
    findById: vi.fn(async () => null),
    findAll: vi.fn(async () => []),
    findByType: vi.fn(async () => []),
    delete: vi.fn(async () => false),
    update: vi.fn(async () => null),
    ...overrides,
  };
}

function authedRequest(overrides: Record<string, any> = {}) {
  return {
    session: { adminUser: { email: 'admin@test.com', authenticatedAt: new Date().toISOString() } },
    ...overrides,
  };
}

// ── Adapter unit tests ──

describe('createMediaRepoAdapter', () => {
  it('findById delegates and converts MediaAsset to MediaAssetRecord', async () => {
    const repo = makeMockAssetRepo({ findById: vi.fn(async () => testAsset) });
    const adapter = createMediaRepoAdapter(repo);

    const result = await adapter.findById('asset-1');

    expect(repo.findById).toHaveBeenCalledWith('asset-1');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('asset-1');
    expect(result!.asset_type).toBe('video');
    expect(result!.original_name).toBe('test-video.mp4');
    expect(result!.created_at).toBe('2024-06-01T12:00:00.000Z');
  });

  it('findById returns null when not found', async () => {
    const repo = makeMockAssetRepo();
    const adapter = createMediaRepoAdapter(repo);

    const result = await adapter.findById('nonexistent');
    expect(result).toBeNull();
  });

  it('findAllNewestFirst delegates to findAll and sorts descending', async () => {
    const olderAsset: MediaAsset = { ...testAsset, id: 'old', createdAt: new Date('2024-01-01T00:00:00Z') };
    const newerAsset: MediaAsset = { ...testThumbnail, id: 'new-thumb', createdAt: new Date('2024-06-01T00:00:00Z') };
    const repo = makeMockAssetRepo({ findAll: vi.fn(async () => [olderAsset, newerAsset]) });
    const adapter = createMediaRepoAdapter(repo);

    const results = await adapter.findAllNewestFirst();

    expect(repo.findAll).toHaveBeenCalled();
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('new-thumb');
    expect(results[1].id).toBe('old');
  });

  it('findVideosNewestFirst delegates to findByType and sorts descending', async () => {
    const olderVideo: MediaAsset = { ...testAsset, id: 'old', createdAt: new Date('2024-01-01T00:00:00Z') };
    const newerVideo: MediaAsset = { ...testAsset, id: 'new', createdAt: new Date('2024-06-01T00:00:00Z') };
    const repo = makeMockAssetRepo({ findByType: vi.fn(async () => [olderVideo, newerVideo]) });
    const adapter = createMediaRepoAdapter(repo);

    const results = await adapter.findVideosNewestFirst();

    expect(repo.findByType).toHaveBeenCalledWith('video');
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('new');
    expect(results[1].id).toBe('old');
  });

  it('findThumbnailByVideoId returns matching thumbnail', async () => {
    const repo = makeMockAssetRepo({
      findByType: vi.fn(async () => [testThumbnail]),
    });
    const adapter = createMediaRepoAdapter(repo);

    const result = await adapter.findThumbnailByVideoId('asset-1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('thumb-1');
    expect(result!.linked_video_asset_id).toBe('asset-1');
  });

  it('findThumbnailByVideoId returns null when no match', async () => {
    const repo = makeMockAssetRepo({ findByType: vi.fn(async () => []) });
    const adapter = createMediaRepoAdapter(repo);

    const result = await adapter.findThumbnailByVideoId('no-match');
    expect(result).toBeNull();
  });

  it('delete delegates to repo.delete', async () => {
    const repo = makeMockAssetRepo({ delete: vi.fn(async () => true) });
    const adapter = createMediaRepoAdapter(repo);

    const result = await adapter.delete('asset-1');

    expect(repo.delete).toHaveBeenCalledWith('asset-1');
    expect(result).toBe(true);
  });

  it('update delegates with converted partial data', async () => {
    const updatedAsset = { ...testAsset, originalName: 'renamed.mp4' };
    const repo = makeMockAssetRepo({ update: vi.fn(async () => updatedAsset) });
    const adapter = createMediaRepoAdapter(repo);

    const result = await adapter.update('asset-1', { original_name: 'renamed.mp4' });

    expect(repo.update).toHaveBeenCalledWith('asset-1', expect.objectContaining({ originalName: 'renamed.mp4' }));
    expect(result).not.toBeNull();
    expect(result!.original_name).toBe('renamed.mp4');
  });

  it('create delegates with converted record data', async () => {
    const repo = makeMockAssetRepo();
    const adapter = createMediaRepoAdapter(repo);

    const record = {
      id: 'new-id',
      asset_type: 'video' as const,
      original_name: 'new.mp4',
      storage_path: '/storage/new.mp4',
      size_bytes: 2048000,
      mime_type: 'video/mp4',
      duration_seconds: 60,
      linked_video_asset_id: null,
      created_at: '2024-07-01T00:00:00.000Z',
    };

    await adapter.create(record);

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      assetType: 'video',
      originalName: 'new.mp4',
      storagePath: '/storage/new.mp4',
      sizeBytes: 2048000,
    }));
  });
});

// ── Controller async tests ──

describe('MediaController with async repository', () => {
  function createAsyncMediaRepo(): MediaRepository {
    const records = new Map<string, any>();
    return {
      create: vi.fn(async (record) => {
        records.set(record.id, record);
        return record;
      }),
      findById: vi.fn(async (id) => records.get(id) ?? null),
      findAllNewestFirst: vi.fn(async () =>
        Array.from(records.values())
          .sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1)),
      ),
      findVideosNewestFirst: vi.fn(async () =>
        Array.from(records.values())
          .filter((r: any) => r.asset_type === 'video')
          .sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1)),
      ),
      findThumbnailByVideoId: vi.fn(async (videoId) =>
        Array.from(records.values()).find(
          (r: any) => r.asset_type === 'thumbnail' && r.linked_video_asset_id === videoId,
        ) ?? null,
      ),
      delete: vi.fn(async (id) => records.delete(id)),
      update: vi.fn(async (id, data) => {
        const record = records.get(id);
        if (!record) return null;
        Object.assign(record, data);
        return record;
      }),
    } as any;
  }

  it('listAssets returns resolved asset array from async repo', async () => {
    const asyncRepo = createAsyncMediaRepo();
    const service = new MediaService({}, asyncRepo);
    const controller = new MediaController(service, new SessionGuard());

    // Seed a video + thumbnail pair
    await asyncRepo.create({
      id: 'v-1',
      asset_type: 'video',
      original_name: 'test.mp4',
      storage_path: '/test.mp4',
      size_bytes: 1000,
      mime_type: 'video/mp4',
      duration_seconds: 10,
      linked_video_asset_id: null,
      created_at: new Date().toISOString(),
    });
    await asyncRepo.create({
      id: 'thumb-1',
      asset_type: 'thumbnail',
      original_name: 'thumb.jpg',
      storage_path: '/thumb.jpg',
      size_bytes: 200,
      mime_type: 'image/jpeg',
      duration_seconds: 0,
      linked_video_asset_id: 'v-1',
      created_at: new Date(Date.now() + 1000).toISOString(),
    });

    const res = await controller.listAssets(authedRequest());

    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body.assets).toBeDefined();
    expect(Array.isArray(body.assets)).toBe(true);
    expect(body.assets).toHaveLength(2);
    expect(body.assets.find((asset: any) => asset.asset_type === 'thumbnail')?.id).toBe('thumb-1');
    expect(body.assets.find((asset: any) => asset.id === 'v-1')?.thumbnail?.id).toBe('thumb-1');
  });

  it('getAsset returns resolved asset from async repo', async () => {
    const asyncRepo = createAsyncMediaRepo();
    const service = new MediaService({}, asyncRepo);
    const controller = new MediaController(service, new SessionGuard());

    await asyncRepo.create({
      id: 'v-1',
      asset_type: 'video',
      original_name: 'test.mp4',
      storage_path: '/test.mp4',
      size_bytes: 1000,
      mime_type: 'video/mp4',
      duration_seconds: 10,
      linked_video_asset_id: null,
      created_at: new Date().toISOString(),
    });

    const res = await controller.getAsset(authedRequest({ params: { id: 'v-1' } }));

    expect(res.status).toBe(200);
    const body = res.body as any;
    expect(body.asset).toBeDefined();
    expect(body.asset.id).toBe('v-1');
  });

  it('deleteAsset returns 404 from async repo when not found', async () => {
    const asyncRepo = createAsyncMediaRepo();
    const service = new MediaService({}, asyncRepo);
    const controller = new MediaController(service, new SessionGuard());

    const res = await controller.deleteAsset(authedRequest({ params: { id: 'nonexistent' } }));

    expect(res.status).toBe(404);
  });
});

// ── Bootstrap wiring test ──

describe('Bootstrap wires Prisma media repo', () => {
  function makeMockPrisma(seedAssets: any[] = []) {
    const assets = [...seedAssets];
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
        create: vi.fn(async ({ data }: any) => data),
        findUnique: vi.fn(async () => null),
        findFirst: vi.fn(async () => null),
        findMany: vi.fn(async () => []),
        update: vi.fn(async () => null),
        delete: vi.fn(async () => null),
      },
      mediaAsset: {
        create: vi.fn(async ({ data }: any) => {
          assets.push(data);
          return data;
        }),
        findUnique: vi.fn(async ({ where }: any) => {
          return assets.find((a: any) => a.id === where.id) ?? null;
        }),
        findMany: vi.fn(async ({ where }: any) => {
          if (!where) return [...assets];
          return assets.filter((a: any) => {
            if (where.assetType && a.assetType !== where.assetType) return false;
            return true;
          });
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const a = assets.find((a: any) => a.id === where.id);
          if (!a) throw { code: 'P2025' };
          Object.assign(a, data);
          return { ...a };
        }),
        delete: vi.fn(async ({ where }: any) => {
          const idx = assets.findIndex((a: any) => a.id === where.id);
          if (idx === -1) throw { code: 'P2025' };
          return assets.splice(idx, 1)[0];
        }),
      },
    };
  }

  it('getAsset returns Prisma-backed data through bootstrap', async () => {
    const seedAsset = {
      id: 'asset-1',
      assetType: 'video',
      originalName: 'test.mp4',
      storagePath: '/storage/test.mp4',
      sizeBytes: 1024000,
      mimeType: 'video/mp4',
      durationSeconds: 120,
      linkedVideoAssetId: null,
      createdAt: new Date('2024-06-01T12:00:00Z'),
    };
    const mockPrisma = makeMockPrisma([seedAsset]);

    const result = bootstrap({
      env: baseEnv,
      _prismaFactory: () => mockPrisma,
    });

    const asset = await result.server.app.mediaModule.mediaService.getAsset('asset-1');
    expect(asset).not.toBeNull();
    expect(asset!.id).toBe('asset-1');
    expect(mockPrisma.mediaAsset.findUnique).toHaveBeenCalled();
  });
});
