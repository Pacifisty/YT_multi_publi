import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TikTokUploadWorker, type TikTokUploadWorkerOptions, type TikTokCreatorInfo } from './tiktok-upload.worker';
import type { PublishJobRecord, PublishJobService } from './publish-job.service';
import type { CampaignService, CampaignTargetRecord } from './campaign.service';
import type { AuditEventService } from './audit-event.service';

describe('TikTokUploadWorker', () => {
  let worker: TikTokUploadWorker;
  let jobService: PublishJobService;
  let campaignService: CampaignService;
  let auditService: AuditEventService;

  const mockJob: PublishJobRecord = {
    id: 'job-123',
    campaignTargetId: 'target-123',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  const mockTarget: CampaignTargetRecord = {
    id: 'target-123',
    campaignId: 'campaign-123',
    platform: 'tiktok',
    destinationId: 'account-123',
    destinationLabel: '@my_account',
    connectedAccountId: 'account-123',
    channelId: null,
    videoTitle: 'My Video Title',
    videoDescription: 'Description here',
    tags: ['#funny', '#trending'],
    publishAt: null,
    playlistId: null,
    privacy: 'public',
    thumbnailAssetId: null,
    status: 'aguardando',
    externalPublishId: null,
    youtubeVideoId: null,
    errorMessage: null,
    retryCount: 0,
    tiktokPrivacyLevel: 'PUBLIC_TO_EVERYONE',
    tiktokDisableComment: false,
    tiktokDisableDuet: false,
    tiktokDisableStitch: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    jobService = {
      pickNext: vi.fn(),
      markCompleted: vi.fn().mockResolvedValue({ ...mockJob, status: 'completed' }),
      markFailed: vi.fn().mockResolvedValue({ ...mockJob, status: 'failed' }),
      getJobsForTarget: vi.fn().mockResolvedValue([]),
    } as any;

    campaignService = {
      getCampaign: vi.fn().mockResolvedValue({
        campaign: {
          ...mockTarget,
          videoAssetId: 'video-asset-123',
          targets: [mockTarget],
        },
      }),
      updateTargetStatus: vi.fn().mockResolvedValue(mockTarget),
      listCampaigns: vi.fn().mockResolvedValue({ campaigns: [] }),
    } as any;

    auditService = {
      record: vi.fn().mockResolvedValue(undefined),
    } as any;
  });

  describe('processPickedJob - happy path', () => {
    it('should publish video and mark completed on success', async () => {
      const creatorInfo: TikTokCreatorInfo = {
        privacyLevelOptions: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'],
      };

      const queryCreatorInfoFn = vi.fn().mockResolvedValue(creatorInfo);
      const publishFn = vi.fn().mockResolvedValue({ publishId: 'pub-123' });
      const fetchStatusFn = vi
        .fn()
        .mockResolvedValueOnce({ status: 'PROCESSING' })
        .mockResolvedValueOnce({ status: 'PROCESSING' })
        .mockResolvedValueOnce({ status: 'PUBLISH_COMPLETE', publiclyAvailablePostId: 'vid-456' });

      worker = new TikTokUploadWorker({
        jobService,
        campaignService,
        auditService,
        queryCreatorInfoFn,
        publishFn,
        fetchStatusFn,
        getAccessToken: vi.fn().mockResolvedValue('token-abc'),
        getPublicVideoUrl: vi.fn().mockResolvedValue('https://r2.example.com/video.mp4'),
      });

      const result = await worker.processPickedJob(mockJob, mockTarget, 'video-asset-123');

      expect(result).toBeDefined();
      expect(jobService.markCompleted).toHaveBeenCalledWith('job-123', 'vid-456');
      expect(campaignService.updateTargetStatus).toHaveBeenCalledWith('campaign-123', 'target-123', 'publicado', {
        externalPublishId: 'vid-456',
      });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'publish_completed',
          campaignId: 'campaign-123',
          targetId: 'target-123',
        }),
      );
    });
  });

  describe('processPickedJob - error handling', () => {
    it('should handle missing connectedAccountId', async () => {
      const targetWithoutAccount = { ...mockTarget, connectedAccountId: null };

      worker = new TikTokUploadWorker({
        jobService,
        campaignService,
        auditService,
        getAccessToken: vi.fn(),
        getPublicVideoUrl: vi.fn(),
      });

      const result = await worker.processPickedJob(mockJob, targetWithoutAccount, 'video-asset-123');

      expect(result).toBeDefined();
      expect(jobService.markFailed).toHaveBeenCalledWith(
        'job-123',
        'TikTok target is missing connectedAccountId',
        expect.any(Object),
      );
    });

    it('should mark target as failed on publish error', async () => {
      const publishFn = vi.fn().mockRejectedValue(new Error('Content policy violation'));

      worker = new TikTokUploadWorker({
        jobService,
        campaignService,
        auditService,
        publishFn,
        getAccessToken: vi.fn().mockResolvedValue('token-abc'),
        getPublicVideoUrl: vi.fn().mockResolvedValue('https://r2.example.com/video.mp4'),
        queryCreatorInfoFn: vi.fn().mockResolvedValue({
          privacyLevelOptions: ['PUBLIC_TO_EVERYONE'],
        }),
      });

      const result = await worker.processPickedJob(mockJob, mockTarget, 'video-asset-123');

      expect(result).toBeDefined();
      expect(jobService.markFailed).toHaveBeenCalled();
      expect(campaignService.updateTargetStatus).toHaveBeenCalledWith('campaign-123', 'target-123', 'erro', {
        errorMessage: 'Content policy violation',
      });
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'publish_failed',
        }),
      );
    });
  });

  describe('Privacy level selection', () => {
    it('should select preferred privacy level when available', async () => {
      const creatorInfo: TikTokCreatorInfo = {
        privacyLevelOptions: ['PUBLIC_TO_EVERYONE', 'SELF_ONLY'],
      };

      const publishFn = vi.fn().mockResolvedValue({ publishId: 'pub-123' });
      const fetchStatusFn = vi.fn().mockResolvedValue({
        status: 'PUBLISH_COMPLETE',
        publiclyAvailablePostId: 'vid-456',
      });

      worker = new TikTokUploadWorker({
        jobService,
        campaignService,
        auditService,
        queryCreatorInfoFn: vi.fn().mockResolvedValue(creatorInfo),
        publishFn,
        fetchStatusFn,
        getAccessToken: vi.fn().mockResolvedValue('token-abc'),
        getPublicVideoUrl: vi.fn().mockResolvedValue('https://r2.example.com/video.mp4'),
      });

      const target = { ...mockTarget, privacy: 'public' };
      await worker.processPickedJob(mockJob, target, 'video-asset-123');

      expect(publishFn).toHaveBeenCalledWith(
        expect.objectContaining({
          privacy: 'PUBLIC_TO_EVERYONE',
        }),
      );
    });

    it('should fallback to SELF_ONLY when preferred level unavailable', async () => {
      const creatorInfo: TikTokCreatorInfo = {
        privacyLevelOptions: ['SELF_ONLY'],
      };

      const publishFn = vi.fn().mockResolvedValue({ publishId: 'pub-123' });
      const fetchStatusFn = vi.fn().mockResolvedValue({
        status: 'PUBLISH_COMPLETE',
        publiclyAvailablePostId: 'vid-456',
      });

      worker = new TikTokUploadWorker({
        jobService,
        campaignService,
        auditService,
        queryCreatorInfoFn: vi.fn().mockResolvedValue(creatorInfo),
        publishFn,
        fetchStatusFn,
        getAccessToken: vi.fn().mockResolvedValue('token-abc'),
        getPublicVideoUrl: vi.fn().mockResolvedValue('https://r2.example.com/video.mp4'),
      });

      const target = { ...mockTarget, privacy: 'public' };
      await worker.processPickedJob(mockJob, target, 'video-asset-123');

      expect(publishFn).toHaveBeenCalledWith(
        expect.objectContaining({
          privacy: 'SELF_ONLY',
        }),
      );
    });
  });

  describe('Status polling', () => {
    it('should poll until PUBLISH_COMPLETE', async () => {
      const fetchStatusFn = vi
        .fn()
        .mockResolvedValueOnce({ status: 'PROCESSING' })
        .mockResolvedValueOnce({ status: 'PROCESSING' })
        .mockResolvedValueOnce({ status: 'PUBLISH_COMPLETE', publiclyAvailablePostId: 'vid-789' });

      worker = new TikTokUploadWorker({
        jobService,
        campaignService,
        auditService,
        queryCreatorInfoFn: vi.fn().mockResolvedValue({
          privacyLevelOptions: ['PUBLIC_TO_EVERYONE'],
        }),
        publishFn: vi.fn().mockResolvedValue({ publishId: 'pub-123' }),
        fetchStatusFn,
        getAccessToken: vi.fn().mockResolvedValue('token-abc'),
        getPublicVideoUrl: vi.fn().mockResolvedValue('https://r2.example.com/video.mp4'),
        sleepMs: vi.fn().mockResolvedValue(undefined),
      });

      await worker.processPickedJob(mockJob, mockTarget, 'video-asset-123');

      expect(fetchStatusFn).toHaveBeenCalledTimes(3);
    });

    it('should timeout after 6 polling attempts', async () => {
      const fetchStatusFn = vi.fn().mockResolvedValue({ status: 'PROCESSING' });

      worker = new TikTokUploadWorker({
        jobService,
        campaignService,
        auditService,
        queryCreatorInfoFn: vi.fn().mockResolvedValue({
          privacyLevelOptions: ['PUBLIC_TO_EVERYONE'],
        }),
        publishFn: vi.fn().mockResolvedValue({ publishId: 'pub-123' }),
        fetchStatusFn,
        getAccessToken: vi.fn().mockResolvedValue('token-abc'),
        getPublicVideoUrl: vi.fn().mockResolvedValue('https://r2.example.com/video.mp4'),
        sleepMs: vi.fn().mockResolvedValue(undefined),
      });

      await worker.processPickedJob(mockJob, mockTarget, 'video-asset-123');

      expect(fetchStatusFn).toHaveBeenCalledTimes(6);
      // Should still mark as completed even if polling times out (allows retry later)
      expect(jobService.markCompleted).toHaveBeenCalled();
    });

    it('should handle FAILED status immediately', async () => {
      const fetchStatusFn = vi.fn().mockResolvedValue({
        status: 'FAILED',
        failReason: 'Content Policy Violation',
      });

      worker = new TikTokUploadWorker({
        jobService,
        campaignService,
        auditService,
        queryCreatorInfoFn: vi.fn().mockResolvedValue({
          privacyLevelOptions: ['PUBLIC_TO_EVERYONE'],
        }),
        publishFn: vi.fn().mockResolvedValue({ publishId: 'pub-123' }),
        fetchStatusFn,
        getAccessToken: vi.fn().mockResolvedValue('token-abc'),
        getPublicVideoUrl: vi.fn().mockResolvedValue('https://r2.example.com/video.mp4'),
      });

      const result = await worker.processPickedJob(mockJob, mockTarget, 'video-asset-123');

      expect(result).toBeDefined();
      expect(jobService.markFailed).toHaveBeenCalledWith(
        'job-123',
        'Content Policy Violation',
        expect.any(Object),
      );
    });
  });

  describe('Title building', () => {
    it('should combine title, description, and tags', async () => {
      const publishFn = vi.fn().mockResolvedValue({ publishId: 'pub-123' });

      worker = new TikTokUploadWorker({
        jobService,
        campaignService,
        auditService,
        queryCreatorInfoFn: vi.fn().mockResolvedValue({
          privacyLevelOptions: ['PUBLIC_TO_EVERYONE'],
        }),
        publishFn,
        fetchStatusFn: vi.fn().mockResolvedValue({
          status: 'PUBLISH_COMPLETE',
          publiclyAvailablePostId: 'vid-456',
        }),
        getAccessToken: vi.fn().mockResolvedValue('token-abc'),
        getPublicVideoUrl: vi.fn().mockResolvedValue('https://r2.example.com/video.mp4'),
      });

      const target = {
        ...mockTarget,
        videoTitle: 'Title',
        videoDescription: 'Description',
        tags: ['funny', 'trending'],
      };

      await worker.processPickedJob(mockJob, target, 'video-asset-123');

      expect(publishFn).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Title'),
        }),
      );
    });

    it('should truncate title at 2200 characters', async () => {
      const publishFn = vi.fn().mockResolvedValue({ publishId: 'pub-123' });

      worker = new TikTokUploadWorker({
        jobService,
        campaignService,
        auditService,
        queryCreatorInfoFn: vi.fn().mockResolvedValue({
          privacyLevelOptions: ['PUBLIC_TO_EVERYONE'],
        }),
        publishFn,
        fetchStatusFn: vi.fn().mockResolvedValue({
          status: 'PUBLISH_COMPLETE',
          publiclyAvailablePostId: 'vid-456',
        }),
        getAccessToken: vi.fn().mockResolvedValue('token-abc'),
        getPublicVideoUrl: vi.fn().mockResolvedValue('https://r2.example.com/video.mp4'),
      });

      const longText = 'a'.repeat(3000);
      const target = {
        ...mockTarget,
        videoTitle: longText,
        videoDescription: '',
        tags: [],
      };

      await worker.processPickedJob(mockJob, target, 'video-asset-123');

      const call = publishFn.mock.calls[0][0];
      expect(call.title.length).toBeLessThanOrEqual(2200);
    });
  });

  describe('Error classification', () => {
    it('should classify content policy errors as permanent', async () => {
      const publishFn = vi.fn().mockRejectedValue(new Error('Content Policy Violation'));

      worker = new TikTokUploadWorker({
        jobService,
        campaignService,
        auditService,
        queryCreatorInfoFn: vi.fn().mockResolvedValue({
          privacyLevelOptions: ['PUBLIC_TO_EVERYONE'],
        }),
        publishFn,
        getAccessToken: vi.fn().mockResolvedValue('token-abc'),
        getPublicVideoUrl: vi.fn().mockResolvedValue('https://r2.example.com/video.mp4'),
      });

      await worker.processPickedJob(mockJob, mockTarget, 'video-asset-123');

      expect(jobService.markFailed).toHaveBeenCalledWith(
        'job-123',
        expect.any(String),
        expect.objectContaining({
          errorClass: 'permanent',
        }),
      );
    });

    it('should classify network errors as transient', async () => {
      const publishFn = vi.fn().mockRejectedValue(new Error('Network timeout'));

      worker = new TikTokUploadWorker({
        jobService,
        campaignService,
        auditService,
        queryCreatorInfoFn: vi.fn().mockResolvedValue({
          privacyLevelOptions: ['PUBLIC_TO_EVERYONE'],
        }),
        publishFn,
        getAccessToken: vi.fn().mockResolvedValue('token-abc'),
        getPublicVideoUrl: vi.fn().mockResolvedValue('https://r2.example.com/video.mp4'),
      });

      await worker.processPickedJob(mockJob, mockTarget, 'video-asset-123');

      expect(jobService.markFailed).toHaveBeenCalledWith(
        'job-123',
        expect.any(String),
        expect.objectContaining({
          errorClass: 'transient',
        }),
      );
    });
  });

  describe('Token refresh integration', () => {
    it('should call getAccessToken with connectedAccountId', async () => {
      const getAccessToken = vi.fn().mockResolvedValue('token-abc');

      worker = new TikTokUploadWorker({
        jobService,
        campaignService,
        auditService,
        queryCreatorInfoFn: vi.fn().mockResolvedValue({
          privacyLevelOptions: ['PUBLIC_TO_EVERYONE'],
        }),
        publishFn: vi.fn().mockResolvedValue({ publishId: 'pub-123' }),
        fetchStatusFn: vi.fn().mockResolvedValue({
          status: 'PUBLISH_COMPLETE',
          publiclyAvailablePostId: 'vid-456',
        }),
        getAccessToken,
        getPublicVideoUrl: vi.fn().mockResolvedValue('https://r2.example.com/video.mp4'),
      });

      await worker.processPickedJob(mockJob, mockTarget, 'video-asset-123');

      expect(getAccessToken).toHaveBeenCalledWith('account-123');
    });
  });

  describe('Media URL handling', () => {
    it('should retrieve public video URL', async () => {
      const getPublicVideoUrl = vi.fn().mockResolvedValue('https://media.r2.com/video.mp4');
      const publishFn = vi.fn().mockResolvedValue({ publishId: 'pub-123' });

      worker = new TikTokUploadWorker({
        jobService,
        campaignService,
        auditService,
        queryCreatorInfoFn: vi.fn().mockResolvedValue({
          privacyLevelOptions: ['PUBLIC_TO_EVERYONE'],
        }),
        publishFn,
        fetchStatusFn: vi.fn().mockResolvedValue({
          status: 'PUBLISH_COMPLETE',
          publiclyAvailablePostId: 'vid-456',
        }),
        getAccessToken: vi.fn().mockResolvedValue('token-abc'),
        getPublicVideoUrl,
      });

      await worker.processPickedJob(mockJob, mockTarget, 'video-asset-123');

      expect(getPublicVideoUrl).toHaveBeenCalledWith('video-asset-123');
      expect(publishFn).toHaveBeenCalledWith(
        expect.objectContaining({
          videoUrl: 'https://media.r2.com/video.mp4',
        }),
      );
    });
  });

  describe('Audit logging', () => {
    it('should log publish_completed event on success', async () => {
      worker = new TikTokUploadWorker({
        jobService,
        campaignService,
        auditService,
        queryCreatorInfoFn: vi.fn().mockResolvedValue({
          privacyLevelOptions: ['PUBLIC_TO_EVERYONE'],
        }),
        publishFn: vi.fn().mockResolvedValue({ publishId: 'pub-123' }),
        fetchStatusFn: vi.fn().mockResolvedValue({
          status: 'PUBLISH_COMPLETE',
          publiclyAvailablePostId: 'vid-456',
        }),
        getAccessToken: vi.fn().mockResolvedValue('token-abc'),
        getPublicVideoUrl: vi.fn().mockResolvedValue('https://r2.example.com/video.mp4'),
      });

      await worker.processPickedJob(mockJob, mockTarget, 'video-asset-123');

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'publish_completed',
          actorEmail: 'system@internal',
          campaignId: 'campaign-123',
          targetId: 'target-123',
        }),
      );
    });

    it('should log publish_failed event on error', async () => {
      worker = new TikTokUploadWorker({
        jobService,
        campaignService,
        auditService,
        queryCreatorInfoFn: vi.fn().mockResolvedValue({
          privacyLevelOptions: ['PUBLIC_TO_EVERYONE'],
        }),
        publishFn: vi.fn().mockRejectedValue(new Error('API error')),
        getAccessToken: vi.fn().mockResolvedValue('token-abc'),
        getPublicVideoUrl: vi.fn().mockResolvedValue('https://r2.example.com/video.mp4'),
      });

      await worker.processPickedJob(mockJob, mockTarget, 'video-asset-123');

      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'publish_failed',
          campaignId: 'campaign-123',
          targetId: 'target-123',
        }),
      );
    });
  });
});
