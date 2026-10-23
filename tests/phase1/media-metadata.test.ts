import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { createMediaModule } from '../../apps/api/src/media/media.module';

const AUTHENTICATED_SESSION = {
  adminUser: {
    email: 'admin@example.com',
  },
};

const VALID_MP4 = Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]);

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

describe('media metadata retrieval', () => {
  test('returns newest-first reusable video rows with complete metadata', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'gsd-media-meta-'));
    tempRoots.push(storageRoot);

    const mediaModule = createMediaModule({ storageRoot });

    await mediaModule.mediaController.createAsset({
      session: AUTHENTICATED_SESSION,
      files: {
        video: [
          {
            originalname: 'older.mp4',
            mimetype: 'video/mp4',
            buffer: VALID_MP4,
            durationSeconds: 30,
          },
        ],
      },
    });

    await mediaModule.mediaController.createAsset({
      session: AUTHENTICATED_SESSION,
      files: {
        video: [
          {
            originalname: 'newer.mp4',
            mimetype: 'video/mp4',
            buffer: VALID_MP4,
            durationSeconds: 45,
          },
        ],
      },
    });

    const response = await mediaModule.mediaController.listAssets({
      session: AUTHENTICATED_SESSION,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      assets: [
        {
          storage_path: expect.stringMatching(/^storage\/videos\//),
          size_bytes: expect.any(Number),
          mime_type: 'video/mp4',
          duration_seconds: 45,
        },
        {
          storage_path: expect.stringMatching(/^storage\/videos\//),
          size_bytes: expect.any(Number),
          mime_type: 'video/mp4',
          duration_seconds: 30,
        },
      ],
    });
  });
});
