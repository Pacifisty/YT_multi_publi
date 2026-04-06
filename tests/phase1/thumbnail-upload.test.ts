import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { createMediaModule } from '../../apps/api/src/media/media.module';

const AUTHENTICATED_SESSION = {
  adminUser: { email: 'admin@example.com' },
};

const tempRoots: string[] = [];

afterEach(async () => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) await rm(root, { recursive: true, force: true });
  }
});

describe('thumbnail upload with video', () => {
  test('upload with video and thumbnail creates linked records', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'gsd-media-'));
    tempRoots.push(storageRoot);

    const mediaModule = createMediaModule({
      storageRoot,
      now: () => new Date('2026-04-04T05:00:00.000Z'),
    });

    const response = await mediaModule.mediaController.createAsset({
      session: AUTHENTICATED_SESSION,
      files: {
        video: [{
          originalname: 'campaign.mp4',
          mimetype: 'video/mp4',
          buffer: Buffer.from('video-bytes'),
          durationSeconds: 180,
        }],
        thumbnail: [{
          originalname: 'cover.jpg',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('thumb-bytes'),
        }],
      },
    });

    expect(response.status).toBe(201);
    const asset = (response.body as any).asset;
    expect(asset.thumbnail).toBeDefined();
    expect(asset.thumbnail.linked_video_asset_id).toBe(asset.id);
    expect(asset.thumbnail.mime_type).toBe('image/jpeg');
  });

  test('upload with video only has no thumbnail', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'gsd-media-'));
    tempRoots.push(storageRoot);

    const mediaModule = createMediaModule({ storageRoot });

    const response = await mediaModule.mediaController.createAsset({
      session: AUTHENTICATED_SESSION,
      files: {
        video: [{
          originalname: 'solo.mp4',
          mimetype: 'video/mp4',
          buffer: Buffer.from('video-bytes'),
          durationSeconds: 60,
        }],
      },
    });

    expect(response.status).toBe(201);
    const asset = (response.body as any).asset;
    expect(asset.thumbnail).toBeUndefined();
  });

  test('thumbnail preview metadata appears in list response when present', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'gsd-media-'));
    tempRoots.push(storageRoot);

    const mediaModule = createMediaModule({
      storageRoot,
      now: () => new Date('2026-04-04T05:00:00.000Z'),
    });

    await mediaModule.mediaController.createAsset({
      session: AUTHENTICATED_SESSION,
      files: {
        video: [{
          originalname: 'vid.mp4',
          mimetype: 'video/mp4',
          buffer: Buffer.from('video-bytes'),
          durationSeconds: 90,
        }],
        thumbnail: [{
          originalname: 'thumb.png',
          mimetype: 'image/png',
          buffer: Buffer.from('thumb-bytes'),
        }],
      },
    });

    const listResponse = await mediaModule.mediaController.listAssets({
      session: AUTHENTICATED_SESSION,
    });

    expect(listResponse.status).toBe(200);
    const assets = (listResponse.body as any).assets;
    expect(assets).toHaveLength(1);
    expect(assets[0].thumbnail).toBeDefined();
    expect(assets[0].thumbnail.storage_path).toMatch(/^storage\/thumbnails\//);
  });

  test('list response shows no thumbnail when none uploaded', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'gsd-media-'));
    tempRoots.push(storageRoot);

    const mediaModule = createMediaModule({ storageRoot });

    await mediaModule.mediaController.createAsset({
      session: AUTHENTICATED_SESSION,
      files: {
        video: [{
          originalname: 'vid.mp4',
          mimetype: 'video/mp4',
          buffer: Buffer.from('video-bytes'),
          durationSeconds: 60,
        }],
      },
    });

    const listResponse = await mediaModule.mediaController.listAssets({
      session: AUTHENTICATED_SESSION,
    });

    const assets = (listResponse.body as any).assets;
    expect(assets).toHaveLength(1);
    expect(assets[0].thumbnail).toBeUndefined();
  });
});
