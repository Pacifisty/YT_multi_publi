import { afterEach, describe, expect, it } from 'vitest';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  InMemoryMediaRepository,
  MediaService,
  type MediaRepository,
} from '../src/media/media.service';
import { LocalStorageService } from '../src/media/storage/local-storage.service';

const temporaryRoots: string[] = [];

async function createTemporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'media-orphan-cleanup-'));
  temporaryRoots.push(root);
  return root;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('media orphan cleanup', () => {
  it('deletes the physical file after deleting its database record', async () => {
    const root = await createTemporaryRoot();
    const service = new MediaService({ storageRoot: root }, new InMemoryMediaRepository());
    const created = await service.createAsset({
      video: {
        originalname: 'video.mp4',
        mimetype: 'video/mp4',
        buffer: Buffer.from('video'),
      },
    }, 'owner@example.com');
    const storedPath = resolve(root, created.asset.storage_path);

    expect(await pathExists(storedPath)).toBe(true);
    await expect(service.deleteAsset(created.asset.id, 'owner@example.com')).resolves.toBe(true);
    expect(await pathExists(storedPath)).toBe(false);
  });

  it('removes unreferenced managed files and preserves referenced files', async () => {
    const root = await createTemporaryRoot();
    const repository = new InMemoryMediaRepository();
    const service = new MediaService({
      storageRoot: root,
      orphanCleanupEnabled: true,
      orphanGracePeriodMs: 0,
    }, repository);
    const created = await service.createAsset({
      video: {
        originalname: 'referenced.mp4',
        mimetype: 'video/mp4',
        buffer: Buffer.from('referenced'),
      },
    });
    const orphanPath = join(root, 'storage', 'videos', 'orphan.mp4');
    await mkdir(join(root, 'storage', 'videos'), { recursive: true });
    await writeFile(orphanPath, Buffer.from('orphan'));

    const result = await service.cleanupOrphanedFiles({ force: true });

    expect(result).toMatchObject({ scanned: 2, deleted: 1, retained: 1, failed: 0, skipped: false });
    expect(await pathExists(orphanPath)).toBe(false);
    expect(await pathExists(resolve(root, created.asset.storage_path))).toBe(true);
  });

  it('keeps fresh orphan files inside the upload grace period', async () => {
    const root = await createTemporaryRoot();
    const orphanPath = join(root, 'storage', 'videos', 'fresh.mp4');
    await mkdir(join(root, 'storage', 'videos'), { recursive: true });
    await writeFile(orphanPath, Buffer.from('fresh'));
    const service = new MediaService({
      storageRoot: root,
      orphanCleanupEnabled: true,
      orphanGracePeriodMs: 60_000,
    }, new InMemoryMediaRepository());

    const result = await service.cleanupOrphanedFiles({ force: true });

    expect(result).toMatchObject({ deleted: 0, retained: 1, failed: 0 });
    expect(await pathExists(orphanPath)).toBe(true);
  });

  it('rolls back a saved file when its database record cannot be created', async () => {
    const root = await createTemporaryRoot();
    const failingRepository: MediaRepository = {
      create: async () => { throw new Error('database unavailable'); },
      findById: async () => null,
      findAllNewestFirst: async () => [],
      findVideosNewestFirst: async () => [],
      findThumbnailByVideoId: async () => null,
      delete: async () => false,
      update: async () => null,
    };
    const service = new MediaService({ storageRoot: root }, failingRepository);

    await expect(service.createAsset({
      video: {
        originalname: 'failed.mp4',
        mimetype: 'video/mp4',
        buffer: Buffer.from('failed'),
      },
    })).rejects.toThrow('database unavailable');

    const storage = new LocalStorageService({ rootDir: root });
    await expect(storage.listManagedFiles()).resolves.toEqual([]);
  });

  it('refuses to delete paths outside the managed media folders', async () => {
    const root = await createTemporaryRoot();
    const outsidePath = join(root, 'do-not-delete.txt');
    await writeFile(outsidePath, 'safe');
    const storage = new LocalStorageService({ rootDir: root });

    await expect(storage.delete('do-not-delete.txt')).rejects.toThrow('outside managed media storage');
    expect(await pathExists(outsidePath)).toBe(true);
  });
});
