import { describe, expect, test, vi } from 'vitest';

import {
  YouTubeUploadWorker,
  type YouTubeUploadFn,
  type UploadContext,
  type UploadResult,
} from '../../apps/api/src/campaigns/youtube-upload.worker';
import { PublishJobService, InMemoryPublishJobRepository } from '../../apps/api/src/campaigns/publish-job.service';
import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';

function createReadyTargetScenario() {
  const campaignRepo = new InMemoryCampaignRepository();
  const campaignService = new CampaignService({ repository: campaignRepo });
  const jobRepo = new InMemoryPublishJobRepository();
  const jobService = new PublishJobService({ repository: jobRepo });

  const { campaign } = campaignService.createCampaign({
    title: 'Test Campaign',
    videoAssetId: 'asset-video-1',
  });

  const { target } = campaignService.addTarget(campaign.id, {
    channelId: 'channel-1',
    videoTitle: 'My Video',
    videoDescription: 'Description here',
    tags: ['test'],
    privacy: 'public',
  });

  campaignService.markReady(campaign.id);
  campaignService.launch(campaign.id);

  const [job] = jobService.enqueueForTargets([{ id: target.id, campaignId: campaign.id }]);

  return { campaignService, jobService, campaign, target, job };
}

describe('YouTube upload worker', () => {
  test('processes a queued job and uploads to YouTube', async () => {
    const { jobService, campaignService, target, campaign } = createReadyTargetScenario();

    const mockUpload: YouTubeUploadFn = vi.fn().mockResolvedValue({
      videoId: 'yt-uploaded-123',
    });

    const worker = new YouTubeUploadWorker({
      jobService,
      campaignService,
      uploadFn: mockUpload,
      getAccessToken: async () => 'mock-access-token',
      getVideoFilePath: async () => '/storage/videos/test.mp4',
    });

    const result = await worker.processNext();

    expect(result).not.toBeNull();
    expect(result!.status).toBe('completed');
    expect(result!.youtubeVideoId).toBe('yt-uploaded-123');

    expect(mockUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'mock-access-token',
        filePath: '/storage/videos/test.mp4',
        title: 'My Video',
        description: 'Description here',
        tags: ['test'],
        privacy: 'public',
      }),
    );
  });

  test('marks job failed when YouTube upload throws', async () => {
    const { jobService, campaignService } = createReadyTargetScenario();

    const mockUpload: YouTubeUploadFn = vi.fn().mockRejectedValue(new Error('quotaExceeded'));

    const worker = new YouTubeUploadWorker({
      jobService,
      campaignService,
      uploadFn: mockUpload,
      getAccessToken: async () => 'mock-access-token',
      getVideoFilePath: async () => '/storage/videos/test.mp4',
    });

    const result = await worker.processNext();

    expect(result).not.toBeNull();
    expect(result!.status).toBe('failed');
    expect(result!.errorMessage).toBe('quotaExceeded');
  });

  test('updates campaign target status to publicado on success', async () => {
    const { jobService, campaignService, campaign, target } = createReadyTargetScenario();

    const mockUpload: YouTubeUploadFn = vi.fn().mockResolvedValue({ videoId: 'yt-999' });

    const worker = new YouTubeUploadWorker({
      jobService,
      campaignService,
      uploadFn: mockUpload,
      getAccessToken: async () => 'token',
      getVideoFilePath: async () => '/path/video.mp4',
    });

    await worker.processNext();

    const updated = campaignService.getCampaign(campaign.id);
    const targetRecord = updated!.campaign.targets.find((t) => t.id === target.id);
    expect(targetRecord!.status).toBe('publicado');
    expect(targetRecord!.youtubeVideoId).toBe('yt-999');
  });

  test('updates campaign target status to erro on failure', async () => {
    const { jobService, campaignService, campaign, target } = createReadyTargetScenario();

    const mockUpload: YouTubeUploadFn = vi.fn().mockRejectedValue(new Error('networkError'));

    const worker = new YouTubeUploadWorker({
      jobService,
      campaignService,
      uploadFn: mockUpload,
      getAccessToken: async () => 'token',
      getVideoFilePath: async () => '/path/video.mp4',
    });

    await worker.processNext();

    const updated = campaignService.getCampaign(campaign.id);
    const targetRecord = updated!.campaign.targets.find((t) => t.id === target.id);
    expect(targetRecord!.status).toBe('erro');
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
    });

    const result = await worker.processNext();
    expect(result).toBeNull();
  });

  test('completes campaign when all targets finish', async () => {
    const campaignRepo = new InMemoryCampaignRepository();
    const campaignService = new CampaignService({ repository: campaignRepo });
    const jobRepo = new InMemoryPublishJobRepository();
    const jobService = new PublishJobService({ repository: jobRepo });

    const { campaign } = campaignService.createCampaign({
      title: 'Multi-target',
      videoAssetId: 'asset-1',
    });

    const { target: t1 } = campaignService.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'V1',
      videoDescription: 'D1',
    });
    const { target: t2 } = campaignService.addTarget(campaign.id, {
      channelId: 'ch-2',
      videoTitle: 'V2',
      videoDescription: 'D2',
    });

    campaignService.markReady(campaign.id);
    campaignService.launch(campaign.id);

    jobService.enqueueForTargets([
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
    });

    await worker.processNext();
    await worker.processNext();

    const final = campaignService.getCampaign(campaign.id);
    expect(final!.campaign.status).toBe('completed');
  });
});
