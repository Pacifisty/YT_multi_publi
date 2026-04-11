import { describe, expect, test, vi } from 'vitest';

import {
  YouTubeUploadWorker,
  YouTubeUploadPartialFailureError,
  type YouTubeUploadFn,
} from '../../apps/api/src/campaigns/youtube-upload.worker';
import { PublishJobService, InMemoryPublishJobRepository } from '../../apps/api/src/campaigns/publish-job.service';
import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';
import { AuditEventService, InMemoryAuditEventRepository } from '../../apps/api/src/campaigns/audit-event.service';

async function createReadyTargetScenario() {
  const campaignRepo = new InMemoryCampaignRepository();
  const campaignService = new CampaignService({ repository: campaignRepo });
  const jobRepo = new InMemoryPublishJobRepository();
  const jobService = new PublishJobService({ repository: jobRepo });

  const { campaign } = await campaignService.createCampaign({
    title: 'Test Campaign',
    videoAssetId: 'asset-video-1',
  });

  const { target } = await campaignService.addTarget(campaign.id, {
    channelId: 'channel-1',
    videoTitle: 'My Video',
    videoDescription: 'Description here',
    tags: ['test'],
    playlistId: 'playlist-123',
    thumbnailAssetId: 'thumb-123',
    privacy: 'public',
  });

  await campaignService.markReady(campaign.id);
  await campaignService.launch(campaign.id);

  const [job] = await jobService.enqueueForTargets([{ id: target.id, campaignId: campaign.id }]);

  return { campaignService, jobService, campaign, target, job };
}

describe('YouTube upload worker', () => {
  test('processes a queued job and uploads to YouTube', async () => {
    const { jobService, campaignService, target, campaign } = await createReadyTargetScenario();

    const mockUpload: YouTubeUploadFn = vi.fn().mockResolvedValue({
      videoId: 'yt-uploaded-123',
    });

    const worker = new YouTubeUploadWorker({
      jobService,
      campaignService,
      uploadFn: mockUpload,
      getAccessToken: async () => 'mock-access-token',
      getVideoFilePath: async () => '/storage/videos/test.mp4',
      getThumbnailFilePath: async () => '/storage/thumbnails/thumb.jpg',
    });

    const result = await worker.processNext();

    expect(result).not.toBeNull();
    expect(result!.status).toBe('completed');
    expect(result!.youtubeVideoId).toBe('yt-uploaded-123');

    expect(mockUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'mock-access-token',
        filePath: '/storage/videos/test.mp4',
        thumbnailFilePath: '/storage/thumbnails/thumb.jpg',
        title: 'My Video',
        description: 'Description here',
        tags: ['test'],
        playlistId: 'playlist-123',
        privacy: 'public',
      }),
    );
  });

  test('marks job failed when YouTube upload throws', async () => {
    const { jobService, campaignService } = await createReadyTargetScenario();

    const mockUpload: YouTubeUploadFn = vi.fn().mockRejectedValue(new Error('quotaExceeded'));

    const worker = new YouTubeUploadWorker({
      jobService,
      campaignService,
      uploadFn: mockUpload,
      getAccessToken: async () => 'mock-access-token',
      getVideoFilePath: async () => '/storage/videos/test.mp4',
      getThumbnailFilePath: async () => '/storage/thumbnails/thumb.jpg',
    });

    const result = await worker.processNext();

    expect(result).not.toBeNull();
    expect(result!.status).toBe('failed');
    expect(result!.errorMessage).toBe('quotaExceeded');
  });

  test('updates campaign target status to publicado on success', async () => {
    const { jobService, campaignService, campaign, target } = await createReadyTargetScenario();

    const mockUpload: YouTubeUploadFn = vi.fn().mockResolvedValue({ videoId: 'yt-999' });

    const worker = new YouTubeUploadWorker({
      jobService,
      campaignService,
      uploadFn: mockUpload,
      getAccessToken: async () => 'token',
      getVideoFilePath: async () => '/path/video.mp4',
      getThumbnailFilePath: async () => '/path/thumb.jpg',
    });

    await worker.processNext();

    const updated = await campaignService.getCampaign(campaign.id);
    const targetRecord = updated!.campaign.targets.find((t) => t.id === target.id);
    expect(targetRecord!.status).toBe('publicado');
    expect(targetRecord!.youtubeVideoId).toBe('yt-999');
  });

  test('records a publish_completed audit event on success when audit service is available', async () => {
    const { jobService, campaignService, campaign, target } = await createReadyTargetScenario();
    const auditService = new AuditEventService({ repository: new InMemoryAuditEventRepository() });

    const worker = new YouTubeUploadWorker({
      jobService,
      campaignService,
      auditService,
      uploadFn: vi.fn().mockResolvedValue({ videoId: 'yt-audit-success' }),
      getAccessToken: async () => 'token',
      getVideoFilePath: async () => '/path/video.mp4',
      getThumbnailFilePath: async () => '/path/thumb.jpg',
    });

    await worker.processNext();

    await expect(auditService.listEvents()).resolves.toEqual([
      expect.objectContaining({
        eventType: 'publish_completed',
        actorEmail: 'system@internal',
        campaignId: campaign.id,
        targetId: target.id,
      }),
    ]);
  });

  test('updates campaign target status to erro on failure', async () => {
    const { jobService, campaignService, campaign, target } = await createReadyTargetScenario();

    const mockUpload: YouTubeUploadFn = vi.fn().mockRejectedValue(new Error('networkError'));

    const worker = new YouTubeUploadWorker({
      jobService,
      campaignService,
      uploadFn: mockUpload,
      getAccessToken: async () => 'token',
      getVideoFilePath: async () => '/path/video.mp4',
      getThumbnailFilePath: async () => '/path/thumb.jpg',
    });

    await worker.processNext();

    const updated = await campaignService.getCampaign(campaign.id);
    const targetRecord = updated!.campaign.targets.find((t) => t.id === target.id);
    expect(targetRecord!.status).toBe('erro');
  });

  test('records a publish_failed audit event on failure when audit service is available', async () => {
    const { jobService, campaignService, campaign, target } = await createReadyTargetScenario();
    const auditService = new AuditEventService({ repository: new InMemoryAuditEventRepository() });

    const worker = new YouTubeUploadWorker({
      jobService,
      campaignService,
      auditService,
      uploadFn: vi.fn().mockRejectedValue(new Error('networkError')),
      getAccessToken: async () => 'token',
      getVideoFilePath: async () => '/path/video.mp4',
      getThumbnailFilePath: async () => '/path/thumb.jpg',
    });

    await worker.processNext();

    await expect(auditService.listEvents()).resolves.toEqual([
      expect.objectContaining({
        eventType: 'publish_failed',
        actorEmail: 'system@internal',
        campaignId: campaign.id,
        targetId: target.id,
      }),
    ]);
  });

  test('preserves uploaded youtubeVideoId when upload fails after the video was already created', async () => {
    const { jobService, campaignService, campaign, target } = await createReadyTargetScenario();

    const mockUpload: YouTubeUploadFn = vi.fn().mockRejectedValue(
      new YouTubeUploadPartialFailureError('Video uploaded as yt-partial-999, but applying the thumbnail failed: forbidden', 'yt-partial-999'),
    );

    const worker = new YouTubeUploadWorker({
      jobService,
      campaignService,
      uploadFn: mockUpload,
      getAccessToken: async () => 'token',
      getVideoFilePath: async () => '/path/video.mp4',
      getThumbnailFilePath: async () => '/path/thumb.jpg',
    });

    const result = await worker.processNext();

    expect(result).not.toBeNull();
    expect(result!.status).toBe('failed');
    expect(result!.youtubeVideoId).toBe('yt-partial-999');

    const updated = await campaignService.getCampaign(campaign.id);
    const targetRecord = updated!.campaign.targets.find((t) => t.id === target.id);
    expect(targetRecord).toMatchObject({
      status: 'erro',
      youtubeVideoId: 'yt-partial-999',
      errorMessage: 'Video uploaded as yt-partial-999, but applying the thumbnail failed: forbidden',
    });
  });

  test('records a publish_partial_failure audit event when the video upload succeeded before a downstream step failed', async () => {
    const { jobService, campaignService, campaign, target } = await createReadyTargetScenario();
    const auditService = new AuditEventService({ repository: new InMemoryAuditEventRepository() });

    const worker = new YouTubeUploadWorker({
      jobService,
      campaignService,
      auditService,
      uploadFn: vi.fn().mockRejectedValue(
        new YouTubeUploadPartialFailureError(
          'Video uploaded as yt-partial-999, but applying the thumbnail failed: forbidden',
          'yt-partial-999',
        ),
      ),
      getAccessToken: async () => 'token',
      getVideoFilePath: async () => '/path/video.mp4',
      getThumbnailFilePath: async () => '/path/thumb.jpg',
    });

    await worker.processNext();

    await expect(auditService.listEvents()).resolves.toEqual([
      expect.objectContaining({
        eventType: 'publish_partial_failure',
        actorEmail: 'system@internal',
        campaignId: campaign.id,
        targetId: target.id,
      }),
    ]);
  });

  test('returns null when no queued jobs', async () => {
    const jobRepo = new InMemoryPublishJobRepository();
    const jobService = new PublishJobService({ repository: jobRepo });
    const campaignRepo = new InMemoryCampaignRepository();
    const campaignService = new CampaignService({ repository: campaignRepo });

    const worker = new YouTubeUploadWorker({
      jobService,
      campaignService,
      uploadFn: vi.fn(),
      getAccessToken: async () => 'token',
      getVideoFilePath: async () => '/path.mp4',
      getThumbnailFilePath: async () => '/thumb.jpg',
    });

    const result = await worker.processNext();
    expect(result).toBeNull();
  });

  test('completes campaign when all targets finish', async () => {
    const campaignRepo = new InMemoryCampaignRepository();
    const campaignService = new CampaignService({ repository: campaignRepo });
    const jobRepo = new InMemoryPublishJobRepository();
    const jobService = new PublishJobService({ repository: jobRepo });

    const { campaign } = await campaignService.createCampaign({
      title: 'Multi-target',
      videoAssetId: 'asset-1',
    });

    const { target: t1 } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'V1',
      videoDescription: 'D1',
    });
    const { target: t2 } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-2',
      videoTitle: 'V2',
      videoDescription: 'D2',
    });

    await campaignService.markReady(campaign.id);
    await campaignService.launch(campaign.id);

    await jobService.enqueueForTargets([
      { id: t1.id, campaignId: campaign.id },
      { id: t2.id, campaignId: campaign.id },
    ]);

    let callCount = 0;
    const mockUpload: YouTubeUploadFn = vi.fn().mockImplementation(async () => {
      callCount++;
      return { videoId: `yt-${callCount}` };
    });

    const worker = new YouTubeUploadWorker({
      jobService,
      campaignService,
      uploadFn: mockUpload,
      getAccessToken: async () => 'token',
      getVideoFilePath: async () => '/path.mp4',
      getThumbnailFilePath: async () => '/thumb.jpg',
    });

    await worker.processNext();
    await worker.processNext();

    const final = await campaignService.getCampaign(campaign.id);
    expect(final!.campaign.status).toBe('completed');
  });
});
