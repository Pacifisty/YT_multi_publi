import { describe, expect, test, vi } from 'vitest';

async function hasPrismaClientInstalled(): Promise<boolean> {
  try {
    await import('@prisma/client');
    return true;
  } catch {
    return false;
  }
}

// ── Prisma Media Asset Repository ────────────────────────────────────────────

describe('PrismaMediaAssetRepository', () => {
  async function loadRepo() {
    const { PrismaMediaAssetRepository } = await import(
      '../../apps/api/src/media/prisma-media-asset.repository'
    );
    return PrismaMediaAssetRepository;
  }

  function makePrisma() {
    return {
      mediaAsset: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };
  }

  const NOW = new Date('2025-06-01T00:00:00Z');

  function assetRow(overrides: Record<string, any> = {}) {
    return {
      id: 'ma-1',
      assetType: 'video',
      originalName: 'intro.mp4',
      storagePath: 'storage/videos/intro.mp4',
      sizeBytes: 1024000,
      mimeType: 'video/mp4',
      durationSeconds: 120,
      linkedVideoAssetId: null,
      createdAt: NOW,
      updatedAt: NOW,
      ...overrides,
    };
  }

  test('create — maps DTO to Prisma call and returns MediaAsset', async () => {
    const Repo = await loadRepo();
    const prisma = makePrisma();

    prisma.mediaAsset.create.mockResolvedValue(assetRow());

    const repo = new Repo(prisma as any);
    const result = await repo.create({
      assetType: 'video',
      originalName: 'intro.mp4',
      storagePath: 'storage/videos/intro.mp4',
      sizeBytes: 1024000,
      mimeType: 'video/mp4',
      durationSeconds: 120,
    });

    expect(result.id).toBe('ma-1');
    expect(result.assetType).toBe('video');
    expect(result.originalName).toBe('intro.mp4');
    expect(result.sizeBytes).toBe(1024000);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(prisma.mediaAsset.create).toHaveBeenCalledOnce();
  });

  test('findById — returns mapped record or null', async () => {
    const Repo = await loadRepo();
    const prisma = makePrisma();

    prisma.mediaAsset.findUnique.mockResolvedValue(assetRow());

    const repo = new Repo(prisma as any);
    const found = await repo.findById('ma-1');
    expect(found).not.toBeNull();
    expect(found!.id).toBe('ma-1');
    expect(found!.storagePath).toBe('storage/videos/intro.mp4');

    prisma.mediaAsset.findUnique.mockResolvedValue(null);
    expect(await repo.findById('nope')).toBeNull();
  });

  test('findAll — returns all mapped records', async () => {
    const Repo = await loadRepo();
    const prisma = makePrisma();

    prisma.mediaAsset.findMany.mockResolvedValue([
      assetRow(),
      assetRow({ id: 'ma-2', assetType: 'thumbnail', originalName: 'thumb.jpg' }),
    ]);

    const repo = new Repo(prisma as any);
    const results = await repo.findAll();
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('ma-1');
    expect(results[1].assetType).toBe('thumbnail');
  });

  test('findByType — filters by asset type', async () => {
    const Repo = await loadRepo();
    const prisma = makePrisma();

    prisma.mediaAsset.findMany.mockResolvedValue([assetRow()]);

    const repo = new Repo(prisma as any);
    const results = await repo.findByType('video');
    expect(results).toHaveLength(1);
    expect(prisma.mediaAsset.findMany).toHaveBeenCalledWith({
      where: { assetType: 'video' },
    });
  });

  test('update — maps partial data and returns updated record', async () => {
    const Repo = await loadRepo();
    const prisma = makePrisma();

    prisma.mediaAsset.update.mockResolvedValue(
      assetRow({ linkedVideoAssetId: 'ma-video-1' }),
    );

    const repo = new Repo(prisma as any);
    const result = await repo.update('ma-1', { linkedVideoAssetId: 'ma-video-1' });
    expect(result).not.toBeNull();
    expect(result!.linkedVideoAssetId).toBe('ma-video-1');
    expect(prisma.mediaAsset.update).toHaveBeenCalledWith({
      where: { id: 'ma-1' },
      data: { linkedVideoAssetId: 'ma-video-1' },
    });
  });

  test('update — returns null when record not found', async () => {
    const Repo = await loadRepo();
    const prisma = makePrisma();

    prisma.mediaAsset.update.mockRejectedValue(
      Object.assign(new Error('Record not found'), { code: 'P2025' }),
    );

    const repo = new Repo(prisma as any);
    const result = await repo.update('nonexistent', { linkedVideoAssetId: 'x' });
    expect(result).toBeNull();
  });

  test('delete — returns true on success, false on not found', async () => {
    const Repo = await loadRepo();
    const prisma = makePrisma();

    prisma.mediaAsset.delete.mockResolvedValue({ id: 'ma-1' });
    const repo = new Repo(prisma as any);
    expect(await repo.delete('ma-1')).toBe(true);

    prisma.mediaAsset.delete.mockRejectedValue(
      Object.assign(new Error('Record not found'), { code: 'P2025' }),
    );
    expect(await repo.delete('nonexistent')).toBe(false);
  });
});

// ── Database Provider Wiring ─────────────────────────────────────────────────

describe('database-provider wiring for media assets', () => {
  test('exposes mediaAssetRepository when _prismaFactory provided', async () => {
    const { createDatabaseProvider } = await import(
      '../../apps/api/src/config/database-provider'
    );

    const fakePrisma = { $connect: vi.fn(), $disconnect: vi.fn() };
    const provider = createDatabaseProvider({
      databaseUrl: 'postgresql://localhost/test',
      _prismaFactory: () => fakePrisma,
    });

    expect(provider.mediaAssetRepository).not.toBeNull();
  });

  test('mediaAssetRepository is null when no _prismaFactory', async () => {
    const { createDatabaseProvider } = await import(
      '../../apps/api/src/config/database-provider'
    );

    const provider = createDatabaseProvider({ databaseUrl: 'postgresql://localhost/test' });
    const hasPrisma = await hasPrismaClientInstalled();

    if (hasPrisma) {
      expect(provider.mediaAssetRepository).not.toBeNull();
      return;
    }

    expect(provider.mediaAssetRepository).toBeNull();
  });

  test('mediaAssetRepository is null when no databaseUrl', async () => {
    const { createDatabaseProvider } = await import(
      '../../apps/api/src/config/database-provider'
    );

    const provider = createDatabaseProvider({});
    expect(provider.mediaAssetRepository).toBeNull();
  });
});
