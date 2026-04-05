import { describe, it, expect, beforeEach } from 'vitest';
import {
  MediaController,
  type MediaRequest,
} from '../../apps/api/src/media/media.controller';
import {
  MediaService,
  InMemoryMediaRepository,
} from '../../apps/api/src/media/media.service';
import { SessionGuard } from '../../apps/api/src/auth/session.guard';
import type { UploadedMediaFile } from '../../apps/api/src/media/storage/local-storage.service';

function fakeVideo(overrides: Partial<UploadedMediaFile> = {}): UploadedMediaFile {
  return {
    originalname: 'clip.mp4',
    mimetype: 'video/mp4',
    size: 5000,
    buffer: Buffer.from('fake'),
    durationSeconds: 60,
    ...overrides,
  } as UploadedMediaFile;
}

function fakeThumbnail(overrides: Partial<UploadedMediaFile> = {}): UploadedMediaFile {
  return {
    originalname: 'thumb.jpg',
    mimetype: 'image/jpeg',
    size: 200,
    buffer: Buffer.from('fake'),
    ...overrides,
  } as UploadedMediaFile;
}

function authedRequest(overrides: Partial<MediaRequest> = {}): MediaRequest {
  return {
    session: { adminUser: { email: 'admin@test.com', authenticatedAt: new Date().toISOString() } },
    ...overrides,
  };
}

function unauthedRequest(overrides: Partial<MediaRequest> = {}): MediaRequest {
  return { session: null, ...overrides };
}

describe('MediaController', () => {
  let repo: InMemoryMediaRepository;
  let service: MediaService;
  let controller: MediaController;

  beforeEach(() => {
    repo = new InMemoryMediaRepository();
    service = new MediaService({ storageRoot: '/tmp/test-media' }, repo);
    controller = new MediaController(service, new SessionGuard());
  });

  describe('getAsset', () => {
    it('returns 401 for unauthenticated request', async () => {
      const res = await controller.getAsset(unauthedRequest({ params: { id: 'x' } }));
      expect(res.status).toBe(401);
    });

    it('returns 404 for nonexistent asset', async () => {
      const res = await controller.getAsset(authedRequest({ params: { id: 'nonexistent' } }));
      expect(res.status).toBe(404);
    });

    it('returns 400 if id is missing', async () => {
      const res = await controller.getAsset(authedRequest({}));
      expect(res.status).toBe(400);
    });

    it('returns asset by id', async () => {
      const createRes = await controller.createAsset(
        authedRequest({ files: { video: [fakeVideo()] } }),
      );
      const assetId = (createRes.body as { asset: { id: string } }).asset.id;

      const res = await controller.getAsset(authedRequest({ params: { id: assetId } }));
      expect(res.status).toBe(200);
      expect((res.body as { asset: { id: string } }).asset.id).toBe(assetId);
    });
  });

  describe('deleteAsset', () => {
    it('returns 401 for unauthenticated request', async () => {
      const res = await controller.deleteAsset(unauthedRequest({ params: { id: 'x' } }));
      expect(res.status).toBe(401);
    });

    it('returns 404 for nonexistent asset', async () => {
      const res = await controller.deleteAsset(authedRequest({ params: { id: 'nonexistent' } }));
      expect(res.status).toBe(404);
    });

    it('returns 400 if id is missing', async () => {
      const res = await controller.deleteAsset(authedRequest({}));
      expect(res.status).toBe(400);
    });

    it('deletes an existing asset', async () => {
      const createRes = await controller.createAsset(
        authedRequest({ files: { video: [fakeVideo()] } }),
      );
      const assetId = (createRes.body as { asset: { id: string } }).asset.id;

      const res = await controller.deleteAsset(authedRequest({ params: { id: assetId } }));
      expect(res.status).toBe(200);
      expect((res.body as { success: boolean }).success).toBe(true);

      const getRes = await controller.getAsset(authedRequest({ params: { id: assetId } }));
      expect(getRes.status).toBe(404);
    });
  });

  describe('linkThumbnail', () => {
    it('returns 401 for unauthenticated request', async () => {
      const res = await controller.linkThumbnail(
        unauthedRequest({ params: { id: 'x' }, body: { videoAssetId: 'y' } }),
      );
      expect(res.status).toBe(401);
    });

    it('returns 400 if videoAssetId is missing in body', async () => {
      const res = await controller.linkThumbnail(
        authedRequest({ params: { id: 'x' }, body: {} }),
      );
      expect(res.status).toBe(400);
    });

    it('returns 404 if thumbnail or video not found', async () => {
      const res = await controller.linkThumbnail(
        authedRequest({ params: { id: 'x' }, body: { videoAssetId: 'y' } }),
      );
      expect(res.status).toBe(404);
    });

    it('links an existing thumbnail to a video', async () => {
      const videoRes = await controller.createAsset(
        authedRequest({ files: { video: [fakeVideo()] } }),
      );
      const videoId = (videoRes.body as { asset: { id: string } }).asset.id;

      const thumbRes = await controller.createAsset(
        authedRequest({ files: { video: [fakeVideo({ originalname: 'v2.mp4' })] } }),
      );
      // We use the second video ID as a target — in real usage this would be a thumbnail record
      // For a simpler test, we create a video+thumbnail pair
      const withThumbRes = await controller.createAsset(
        authedRequest({ files: { video: [fakeVideo()], thumbnail: [fakeThumbnail()] } }),
      );
      const asset = (withThumbRes.body as { asset: { id: string; thumbnail?: { id: string } } }).asset;
      const thumbnailId = asset.thumbnail!.id;

      const res = await controller.linkThumbnail(
        authedRequest({ params: { id: thumbnailId }, body: { videoAssetId: videoId } }),
      );
      expect(res.status).toBe(200);
      expect((res.body as { success: boolean }).success).toBe(true);
    });
  });
});
