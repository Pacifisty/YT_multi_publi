import { describe, expect, test, vi } from 'vitest';

import { YouTubeUploadWorker, type YouTubeUploadFn } from '../../apps/api/src/campaigns/youtube-upload.worker';
import { CampaignStatusService } from '../../apps/api/src/campaigns/campaign-status.service';
import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';
import { InMemoryPublishJobRepository, PublishJobService } from '../../apps/api/src/campaigns/publish-job.service';

async function createReadyTargetScenario() {
  const campaignRepo = new InMemoryCampaignRepository();
  const campaignService = new CampaignService({ repository: campaignRepo });
  const jobRepo = new InMemoryPublishJobRepository();
  const jobService = new PublishJobService({ repository: jobRepo });
  const statusService = new CampaignStatusService({ campaignService, jobService });

  const { campaign } = await campaignService.createCampaign({
    title: 'Empty error hardening',
    videoAssetId: 'asset-video-1',
  });

  const { target } = await campaignService.addTarget(campaign.id, {
    channelId: 'channel-1',
    videoTitle: 'My Video',
    videoDescription: 'Description here',
    tags: ['test'],
    privacy: 'public',
  });

  await campaignService.markReady(campaign.id);
  await campaignService.launch(campaign.id);
  await jobService.enqueueForTargets([{ id: target.id, campaignId: campaign.id }]);

  return { campaignService, jobService, statusService, campaign, target };
}

describe('youtube upload worker empty error hardening', () => {
  test('processNext normalizes an empty upload error message so the target can still transition to erro', async () => {
    const { campaignService, jobService, statusService, campaign, target } = await createReadyTargetScenario();

    const mockUpload: YouTubeUploadFn = vi.fn().mockRejectedValue(new Error(''));

    const worker = new YouTubeUploadWorker({
      jobService,
      campaignService,
      uploadFn: mockUpload,
      getAccessToken: async () => 'token',
      getVideoFilePath: async () => '/path/video.mp4',
    });

    const result = await worker.processNext();

    expect(result).not.toBeNull();
    expect(result!.status).toBe('failed');
    expect(result!.errorMessage).toBe('Unknown error');

    const updated = await campaignService.getCampaign(campaign.id);
    const targetRecord = updated!.campaign.targets.find((t) => t.id === target.id);
    expect(targetRecord).toMatchObject({
      status: 'erro',
      errorMessage: 'Unknown error',
    });

    const liveStatus = await statusService.getStatus(campaign.id);
    expect(liveStatus!.campaignStatus).toBe('failed');
    expect(liveStatus!.shouldPoll).toBe(false);
  });

  test('processNext also normalizes whitespace-only upload errors', async () => {
    const { campaignService, jobService, campaign, target } = await createReadyTargetScenario();

    const mockUpload: YouTubeUploadFn = vi.fn().mockRejectedValue(new Error('   '));

    const worker = new YouTubeUploadWorker({
      jobService,
      campaignService,
      uploadFn: mockUpload,
      getAccessToken: async () => 'token',
      getVideoFilePath: async () => '/path/video.mp4',
    });

    const result = await worker.processNext();

    expect(result).not.toBeNull();
    expect(result!.errorMessage).toBe('Unknown error');

    const updated = await campaignService.getCampaign(campaign.id);
    const targetRecord = updated!.campaign.targets.find((t) => t.id === target.id);
    expect(targetRecord!.errorMessage).toBe('Unknown error');
  });
});
