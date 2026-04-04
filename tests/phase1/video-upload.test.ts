import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { createMediaModule } from '../../apps/api/src/media/media.module';

const AUTHENTICATED_SESSION = {
  adminUser: {
    email: 'admin@example.com',
  },
};

const tempRoots: string[] = [];

afterEach(async () => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (!root) {
      continue;
    }

    await rm(root, { recursive: true, force: true });
  }
});

describe('media upload API and local storage contracts', () => {
  test('stores one video and optional thumbnail with reusable metadata', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'gsd-media-'));
    tempRoots.push(storageRoot);

    const mediaModule = createMediaModule({
      storageRoot,
      now: () => new Date('2026-04-04T04:00:00.000Z'),
    });

    const response = await mediaModule.mediaController.createAsset({
      session: AUTHENTICATED_SESSION,
      files: {
        video: [
          {
            originalname: 'launch.mp4',
            mimetype: 'video/mp4',
            buffer: Buffer.from('video-content'),
            durationSeconds: 120,
          },
        ],
        thumbnail: [
          {
            originalname: 'launch.png',
            mimetype: 'image/png',
            buffer: Buffer.from('thumbnail-content'),
          },
        ],
      },
    });

    expect(response.status).toBe(201);
    expect(response.body.asset.storage_path).toMatch(/^storage\/videos\//);
    expect(response.body.asset.thumbnail).toMatchObject({
      storage_path: expect.stringMatching(/^storage\/thumbnails\//),
      linked_video_asset_id: response.body.asset.id,
    });
    expect(response.body.asset.size_bytes).toBeGreaterThan(0);
    expect(response.body.asset.duration_seconds).toBe(120);

    const storedVideo = await stat(join(storageRoot, response.body.asset.storage_path));
    const storedThumbnail = await stat(join(storageRoot, response.body.asset.thumbnail.storage_path));

    expect(storedVideo.isFile()).toBe(true);
    expect(storedThumbnail.isFile()).toBe(true);
  });

  test('rejects unauthenticated upload requests', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'gsd-media-'));
    tempRoots.push(storageRoot);

    const mediaModule = createMediaModule({ storageRoot });

    const response = await mediaModule.mediaController.createAsset({
      files: {
        video: [
          {
            originalname: 'launch.mp4',
            mimetype: 'video/mp4',
            buffer: Buffer.from('video-content'),
            durationSeconds: 120,
          },
        ],
      },
    });

    expect(response).toEqual({
      status: 401,
      body: {
        error: 'Unauthorized',
      },
    });
  });
});
