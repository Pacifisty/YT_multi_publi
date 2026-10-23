import { describe, expect, test, vi } from 'vitest';

import { TikTokUploadWorker } from '../src/campaigns/tiktok-upload.worker';

describe('TikTok sandbox publishing', () => {
  test('forces SELF_ONLY even when the campaign requested public visibility', async () => {
    const publishFn = vi.fn().mockResolvedValue({ publishId: 'pub-private' });
    const worker = new TikTokUploadWorker({
      jobService: {
        markCompleted: vi.fn().mockResolvedValue({ status: 'completed' }),
        markFailed: vi.fn(),
      } as any,
      campaignService: {
        updateTargetStatus: vi.fn().mockResolvedValue(undefined),
      } as any,
      forcePrivatePublishing: true,
      queryCreatorInfoFn: vi.fn().mockResolvedValue({
        privacyLevelOptions: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'],
      }),
      publishFn,
      fetchStatusFn: vi.fn().mockResolvedValue({
        status: 'PUBLISH_COMPLETE',
        publiclyAvailablePostId: 'video-private',
      }),
      getAccessToken: vi.fn().mockResolvedValue('token'),
      getPublicVideoUrl: vi.fn().mockResolvedValue('https://plataformmultipublisher.com/api/media/file/video'),
    });

    await worker.processPickedJob(
      { id: 'job', campaignTargetId: 'target', status: 'queued', createdAt: new Date().toISOString() } as any,
      {
        id: 'target',
        campaignId: 'campaign',
        platform: 'tiktok',
        connectedAccountId: 'account',
        videoTitle: 'Video',
        videoDescription: '',
        tags: [],
        privacy: 'public',
        tiktokPrivacyLevel: null,
        tiktokDisableComment: false,
        tiktokDisableDuet: false,
        tiktokDisableStitch: false,
      } as any,
      'asset',
    );

    expect(publishFn).toHaveBeenCalledWith(expect.objectContaining({
      privacy: 'SELF_ONLY',
    }));
  });
});
