import { describe, expect, test } from 'vitest';

import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';
import { PublishJobService, InMemoryPublishJobRepository } from '../../apps/api/src/campaigns/publish-job.service';
import { CampaignStatusService } from '../../apps/api/src/campaigns/campaign-status.service';

function createStatusStack() {
  const campaignService = new CampaignService({ repository: new InMemoryCampaignRepository() });
  const jobService = new PublishJobService({ repository: new InMemoryPublishJobRepository() });
  const statusService = new CampaignStatusService({ campaignService, jobService });
  return { campaignService, jobService, statusService };
}

describe('campaign status shouldPoll hardening', () => {
  test('does not keep polling for a ready campaign that has not launched yet', async () => {
    const { campaignService, statusService } = createStatusStack();

    const { campaign } = await campaignService.createCampaign({ title: 'Ready campaign', videoAssetId: 'asset-1' });
    await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'Video',
      videoDescription: 'Desc',
    });
    await campaignService.markReady(campaign.id);

    const result = await statusService.getStatus(campaign.id);

    expect(result).not.toBeNull();
    expect(result!.campaignStatus).toBe('ready');
    expect(result!.shouldPoll).toBe(false);
  });

  test('does not keep polling for a draft campaign with no active work', async () => {
    const { campaignService, statusService } = createStatusStack();

    const { campaign } = await campaignService.createCampaign({ title: 'Draft campaign', videoAssetId: 'asset-1' });

    const result = await statusService.getStatus(campaign.id);

    expect(result).not.toBeNull();
    expect(result!.campaignStatus).toBe('draft');
    expect(result!.shouldPoll).toBe(false);
  });
});
