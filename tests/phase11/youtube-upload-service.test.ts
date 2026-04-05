import { describe, expect, test, vi } from 'vitest';

import {
  YouTubeUploadService,
  type YouTubeUploadServiceOptions,
  type ChannelTokenResolver,
  type VideoFileResolver,
} from '../../apps/api/src/integrations/youtube/youtube-upload.service';

function createMockResolver(): ChannelTokenResolver {
  return {
    resolve: vi.fn().mockResolvedValue({ accessToken: 'mock-token-123' }),
  };
}

function createMockFileResolver(): VideoFileResolver {
  return {
    resolve: vi.fn().mockResolvedValue('/uploads/video.mp4'),
  };
}

describe('YouTubeUploadService', () => {
  test('uploads a video and returns the YouTube video ID', async () => {
    const uploadFn = vi.fn().mockResolvedValue({ videoId: 'yt-video-1' });
    const tokenResolver = createMockResolver();
    const fileResolver = createMockFileResolver();

    const service = new YouTubeUploadService({
      uploadFn,
      channelTokenResolver: tokenResolver,
      videoFileResolver: fileResolver,
    });

    const result = await service.upload({
      channelId: 'ch-1',
      videoAssetId: 'asset-1',
      title: 'My Video',
      description: 'A description',
      tags: ['tag1', 'tag2'],
      privacy: 'private',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.videoId).toBe('yt-video-1');
    }

    expect(tokenResolver.resolve).toHaveBeenCalledWith('ch-1');
    expect(fileResolver.resolve).toHaveBeenCalledWith('asset-1');
    expect(uploadFn).toHaveBeenCalledWith({
      accessToken: 'mock-token-123',
      filePath: '/uploads/video.mp4',
      title: 'My Video',
      description: 'A description',
      tags: ['tag1', 'tag2'],
      privacy: 'private',
    });
  });

  test('returns error when token resolution fails', async () => {
    const uploadFn = vi.fn();
    const tokenResolver: ChannelTokenResolver = {
      resolve: vi.fn().mockRejectedValue(new Error('Account not found')),
    };
    const fileResolver = createMockFileResolver();

    const service = new YouTubeUploadService({
      uploadFn,
      channelTokenResolver: tokenResolver,
      videoFileResolver: fileResolver,
    });

    const result = await service.upload({
      channelId: 'ch-bad',
      videoAssetId: 'asset-1',
      title: 'V',
      description: 'D',
      tags: [],
      privacy: 'private',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Account not found');
    }
    expect(uploadFn).not.toHaveBeenCalled();
  });

  test('returns error when file resolution fails', async () => {
    const uploadFn = vi.fn();
    const tokenResolver = createMockResolver();
    const fileResolver: VideoFileResolver = {
      resolve: vi.fn().mockRejectedValue(new Error('File not found')),
    };

    const service = new YouTubeUploadService({
      uploadFn,
      channelTokenResolver: tokenResolver,
      videoFileResolver: fileResolver,
    });

    const result = await service.upload({
      channelId: 'ch-1',
      videoAssetId: 'asset-missing',
      title: 'V',
      description: 'D',
      tags: [],
      privacy: 'private',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('File not found');
    }
    expect(uploadFn).not.toHaveBeenCalled();
  });

  test('returns error when YouTube upload fails', async () => {
    const uploadFn = vi.fn().mockRejectedValue(new Error('quotaExceeded'));
    const tokenResolver = createMockResolver();
    const fileResolver = createMockFileResolver();

    const service = new YouTubeUploadService({
      uploadFn,
      channelTokenResolver: tokenResolver,
      videoFileResolver: fileResolver,
    });

    const result = await service.upload({
      channelId: 'ch-1',
      videoAssetId: 'asset-1',
      title: 'V',
      description: 'D',
      tags: [],
      privacy: 'private',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('quotaExceeded');
    }
  });

  test('provides getAccessToken and getVideoFilePath helpers for worker integration', async () => {
    const tokenResolver = createMockResolver();
    const fileResolver = createMockFileResolver();

    const service = new YouTubeUploadService({
      uploadFn: vi.fn(),
      channelTokenResolver: tokenResolver,
      videoFileResolver: fileResolver,
    });

    const token = await service.getAccessToken('ch-1');
    expect(token).toBe('mock-token-123');

    const filePath = await service.getVideoFilePath('asset-1');
    expect(filePath).toBe('/uploads/video.mp4');
  });
});
