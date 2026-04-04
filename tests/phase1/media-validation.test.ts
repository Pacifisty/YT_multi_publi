import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import { MediaValidationService, VALIDATION_RULES } from '../../apps/api/src/media/media-validation.service';
import { createMediaModule } from '../../apps/api/src/media/media.module';

// --- Unit tests for MediaValidationService ---

describe('MediaValidationService', () => {
  const validator = new MediaValidationService();

  describe('video validation', () => {
    test('accepts valid mp4 video within size and duration limits', () => {
      const result = validator.validateVideo({
        originalname: 'launch.mp4',
        mimetype: 'video/mp4',
        buffer: Buffer.alloc(100),
        size: 100,
        durationSeconds: 300,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('accepts valid quicktime video', () => {
      const result = validator.validateVideo({
        originalname: 'launch.mov',
        mimetype: 'video/quicktime',
        buffer: Buffer.alloc(100),
        size: 100,
        durationSeconds: 60,
      });
      expect(result.valid).toBe(true);
    });

    test('rejects unsupported video MIME type with INVALID_VIDEO_TYPE', () => {
      const result = validator.validateVideo({
        originalname: 'file.avi',
        mimetype: 'video/x-msvideo',
        buffer: Buffer.alloc(100),
        size: 100,
        durationSeconds: 60,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'INVALID_VIDEO_TYPE' }),
      );
    });

    test('rejects video exceeding max size with VIDEO_TOO_LARGE', () => {
      const overSize = VALIDATION_RULES.VIDEO_MAX_SIZE_BYTES + 1;
      const result = validator.validateVideo({
        originalname: 'big.mp4',
        mimetype: 'video/mp4',
        buffer: Buffer.alloc(1),
        size: overSize,
        durationSeconds: 60,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'VIDEO_TOO_LARGE' }),
      );
    });

    test('rejects video exceeding max duration with VIDEO_DURATION_EXCEEDED', () => {
      const result = validator.validateVideo({
        originalname: 'long.mp4',
        mimetype: 'video/mp4',
        buffer: Buffer.alloc(100),
        size: 100,
        durationSeconds: VALIDATION_RULES.VIDEO_MAX_DURATION_SECONDS + 1,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'VIDEO_DURATION_EXCEEDED' }),
      );
    });

    test('returns multiple errors when multiple rules violated', () => {
      const result = validator.validateVideo({
        originalname: 'bad.avi',
        mimetype: 'video/x-msvideo',
        buffer: Buffer.alloc(1),
        size: VALIDATION_RULES.VIDEO_MAX_SIZE_BYTES + 1,
        durationSeconds: VALIDATION_RULES.VIDEO_MAX_DURATION_SECONDS + 1,
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('thumbnail validation', () => {
    test('accepts valid jpeg thumbnail within size limit', () => {
      const result = validator.validateThumbnail({
        originalname: 'thumb.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.alloc(100),
        size: 100,
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('accepts valid png thumbnail', () => {
      const result = validator.validateThumbnail({
        originalname: 'thumb.png',
        mimetype: 'image/png',
        buffer: Buffer.alloc(100),
        size: 100,
      });
      expect(result.valid).toBe(true);
    });

    test('rejects unsupported thumbnail MIME with INVALID_THUMBNAIL_TYPE', () => {
      const result = validator.validateThumbnail({
        originalname: 'thumb.gif',
        mimetype: 'image/gif',
        buffer: Buffer.alloc(100),
        size: 100,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'INVALID_THUMBNAIL_TYPE' }),
      );
    });

    test('rejects thumbnail exceeding max size with THUMBNAIL_TOO_LARGE', () => {
      const overSize = VALIDATION_RULES.THUMBNAIL_MAX_SIZE_BYTES + 1;
      const result = validator.validateThumbnail({
        originalname: 'big.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.alloc(1),
        size: overSize,
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ code: 'THUMBNAIL_TOO_LARGE' }),
      );
    });
  });
});

// --- Integration: controller uses validation gate ---

describe('media controller validation gate', () => {
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

  test('rejects invalid video MIME before persistence', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'gsd-media-'));
    tempRoots.push(storageRoot);

    const mediaModule = createMediaModule({ storageRoot });
    const response = await mediaModule.mediaController.createAsset({
      session: AUTHENTICATED_SESSION,
      files: {
        video: [{
          originalname: 'file.avi',
          mimetype: 'video/x-msvideo',
          buffer: Buffer.from('video-content'),
          durationSeconds: 60,
        }],
      },
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('code', 'INVALID_VIDEO_TYPE');
  });

  test('rejects oversized video before persistence', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'gsd-media-'));
    tempRoots.push(storageRoot);

    const mediaModule = createMediaModule({ storageRoot });
    const response = await mediaModule.mediaController.createAsset({
      session: AUTHENTICATED_SESSION,
      files: {
        video: [{
          originalname: 'big.mp4',
          mimetype: 'video/mp4',
          buffer: Buffer.alloc(1),
          size: VALIDATION_RULES.VIDEO_MAX_SIZE_BYTES + 1,
          durationSeconds: 60,
        }],
      },
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('code', 'VIDEO_TOO_LARGE');
  });

  test('rejects video over duration limit before persistence', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'gsd-media-'));
    tempRoots.push(storageRoot);

    const mediaModule = createMediaModule({ storageRoot });
    const response = await mediaModule.mediaController.createAsset({
      session: AUTHENTICATED_SESSION,
      files: {
        video: [{
          originalname: 'long.mp4',
          mimetype: 'video/mp4',
          buffer: Buffer.from('video-content'),
          durationSeconds: VALIDATION_RULES.VIDEO_MAX_DURATION_SECONDS + 1,
        }],
      },
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('code', 'VIDEO_DURATION_EXCEEDED');
  });

  test('rejects invalid thumbnail MIME before persistence', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'gsd-media-'));
    tempRoots.push(storageRoot);

    const mediaModule = createMediaModule({ storageRoot });
    const response = await mediaModule.mediaController.createAsset({
      session: AUTHENTICATED_SESSION,
      files: {
        video: [{
          originalname: 'ok.mp4',
          mimetype: 'video/mp4',
          buffer: Buffer.from('video-content'),
          durationSeconds: 60,
        }],
        thumbnail: [{
          originalname: 'thumb.gif',
          mimetype: 'image/gif',
          buffer: Buffer.from('thumbnail-content'),
        }],
      },
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('code', 'INVALID_THUMBNAIL_TYPE');
  });

  test('rejects oversized thumbnail before persistence', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'gsd-media-'));
    tempRoots.push(storageRoot);

    const mediaModule = createMediaModule({ storageRoot });
    const response = await mediaModule.mediaController.createAsset({
      session: AUTHENTICATED_SESSION,
      files: {
        video: [{
          originalname: 'ok.mp4',
          mimetype: 'video/mp4',
          buffer: Buffer.from('video-content'),
          durationSeconds: 60,
        }],
        thumbnail: [{
          originalname: 'big.jpg',
          mimetype: 'image/jpeg',
          buffer: Buffer.alloc(1),
          size: VALIDATION_RULES.THUMBNAIL_MAX_SIZE_BYTES + 1,
        }],
      },
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('code', 'THUMBNAIL_TOO_LARGE');
  });

  test('allows valid upload to proceed through validation gate', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'gsd-media-'));
    tempRoots.push(storageRoot);

    const mediaModule = createMediaModule({ storageRoot });
    const response = await mediaModule.mediaController.createAsset({
      session: AUTHENTICATED_SESSION,
      files: {
        video: [{
          originalname: 'ok.mp4',
          mimetype: 'video/mp4',
          buffer: Buffer.from('video-content'),
          durationSeconds: 120,
        }],
        thumbnail: [{
          originalname: 'thumb.png',
          mimetype: 'image/png',
          buffer: Buffer.from('thumbnail-content'),
        }],
      },
    });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('asset');
  });
});

// --- Validation rules are exported as explicit constants ---

describe('validation rules constants', () => {
  test('video max size is 2 GB', () => {
    expect(VALIDATION_RULES.VIDEO_MAX_SIZE_BYTES).toBe(2 * 1024 * 1024 * 1024);
  });

  test('thumbnail max size is 5 MB', () => {
    expect(VALIDATION_RULES.THUMBNAIL_MAX_SIZE_BYTES).toBe(5 * 1024 * 1024);
  });

  test('video max duration is 21600 seconds', () => {
    expect(VALIDATION_RULES.VIDEO_MAX_DURATION_SECONDS).toBe(21600);
  });

  test('accepted video MIME types include mp4 and quicktime', () => {
    expect(VALIDATION_RULES.ACCEPTED_VIDEO_MIMES).toContain('video/mp4');
    expect(VALIDATION_RULES.ACCEPTED_VIDEO_MIMES).toContain('video/quicktime');
  });

  test('accepted thumbnail MIME types include jpeg and png', () => {
    expect(VALIDATION_RULES.ACCEPTED_THUMBNAIL_MIMES).toContain('image/jpeg');
    expect(VALIDATION_RULES.ACCEPTED_THUMBNAIL_MIMES).toContain('image/png');
  });
});
