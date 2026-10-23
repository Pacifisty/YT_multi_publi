import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { createMediaModule } from '../../apps/api/src/media/media.module';

const AUTHENTICATED_SESSION = {
  adminUser: { email: 'admin@example.com' },
};

const VALID_MP4 = Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);
const VALID_JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const VALID_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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
          buffer: VALID_MP4,
          durationSeconds: 180,
        }],
        thumbnail: [{
          originalname: 'cover.jpg',
          mimetype: 'image/jpeg',
          buffer: VALID_JPEG,
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
          buffer: VALID_MP4,
          durationSeconds: 60,
        }],
      },
    });

    expect(response.status).toBe(201);
    const asset = (response.body as any).asset;
    expect(asset.thumbnail).toBeUndefined();
  });

  test('does not expose another account or unowned media to an authenticated account', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'gsd-media-'));
    tempRoots.push(storageRoot);
    const mediaModule = createMediaModule({ storageRoot });

    await mediaModule.mediaService.createAsset({
      video: {
        originalname: 'legacy.mp4',
        mimetype: 'video/mp4',
        buffer: Buffer.from('legacy-video'),
      },
    });
    await mediaModule.mediaService.createAsset({
      video: {
        originalname: 'owner-a.mp4',
        mimetype: 'video/mp4',
        buffer: Buffer.from('owner-a-video'),
      },
    }, 'owner-a@example.com');

    const response = await mediaModule.mediaController.listAssets({
      session: { adminUser: { email: 'owner-b@example.com' } },
    });

    expect(response.status).toBe(200);
    expect((response.body as any).assets).toEqual([]);
  });

  test('creates a thumbnail extracted later for an existing video', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'gsd-media-'));
    tempRoots.push(storageRoot);
    const mediaModule = createMediaModule({ storageRoot });

    const upload = await mediaModule.mediaController.createAsset({
      session: AUTHENTICATED_SESSION,
      files: {
        video: [{
          originalname: 'vertical.mp4',
          mimetype: 'video/mp4',
          buffer: VALID_MP4,
          durationSeconds: 45,
        }],
      },
    });
    const videoId = (upload.body as any).asset.id;

    const response = await mediaModule.mediaController.createThumbnailForVideo({
      session: AUTHENTICATED_SESSION,
      params: { id: videoId },
      body: {
        thumbnail: {
          originalName: 'frame-12s.jpg',
          mimeType: 'image/jpeg',
          base64Data: VALID_JPEG.toString('base64'),
        },
      },
    });

    expect(response.status).toBe(201);
    expect((response.body as any).thumbnail).toMatchObject({
      asset_type: 'thumbnail',
      linked_video_asset_id: videoId,
      original_name: 'frame-12s.jpg',
    });
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
          buffer: VALID_MP4,
          durationSeconds: 90,
        }],
        thumbnail: [{
          originalname: 'thumb.png',
          mimetype: 'image/png',
          buffer: VALID_PNG,
        }],
      },
    });

    const listResponse = await mediaModule.mediaController.listAssets({
      session: AUTHENTICATED_SESSION,
    });

    expect(listResponse.status).toBe(200);
    const assets = (listResponse.body as any).assets;
    const video = assets.find((asset: any) => asset.asset_type === 'video');
    expect(video.thumbnail).toBeDefined();
    expect(video.thumbnail.storage_path).toMatch(/^storage\/thumbnails\//);
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
          buffer: VALID_MP4,
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
