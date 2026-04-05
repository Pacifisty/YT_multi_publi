import { describe, expect, test, vi } from 'vitest';

import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';
import { PublishJobService, InMemoryPublishJobRepository } from '../../apps/api/src/campaigns/publish-job.service';
import { LaunchService } from '../../apps/api/src/campaigns/launch.service';

describe('launch service', () => {
  test('transitions campaign to launching and enqueues one job per target', () => {
    const campaignRepo = new InMemoryCampaignRepository();
    const campaignService = new CampaignService({ repository: campaignRepo });
    const jobRepo = new InMemoryPublishJobRepository();
    const jobService = new PublishJobService({ repository: jobRepo });

    const { campaign } = campaignService.createCampaign({
      title: 'Launch Test',
      videoAssetId: 'asset-1',
    });

    campaignService.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'V1',
      videoDescription: 'D1',
    });
    campaignService.addTarget(campaign.id, {
      channelId: 'ch-2',
      videoTitle: 'V2',
      videoDescription: 'D2',
    });

    campaignService.markReady(campaign.id);

    const launchService = new LaunchService({ campaignService, jobService });
    const result = launchService.launchCampaign(campaign.id);

    expect('campaign' in result).toBe(true);
    if ('campaign' in result) {
      expect(result.campaign.status).toBe('launching');

      // One job per target
      const t1Jobs = jobService.getJobsForTarget(result.campaign.targets[0].id);
      const t2Jobs = jobService.getJobsForTarget(result.campaign.targets[1].id);
      expect(t1Jobs).toHaveLength(1);
      expect(t2Jobs).toHaveLength(1);
      expect(t1Jobs[0].status).toBe('queued');
    }
  });

  test('rejects launch for draft campaign', () => {
    const campaignRepo = new InMemoryCampaignRepository();
    const campaignService = new CampaignService({ repository: campaignRepo });
    const jobRepo = new InMemoryPublishJobRepository();
    const jobService = new PublishJobService({ repository: jobRepo });

    const { campaign } = campaignService.createCampaign({
      title: 'Draft',
      videoAssetId: 'asset-1',
    });

    const launchService = new LaunchService({ campaignService, jobService });
    const result = launchService.launchCampaign(campaign.id);

    expect('error' in result).toBe(true);
  });

  test('rejects launch for non-existent campaign', () => {
    const campaignService = new CampaignService();
    const jobService = new PublishJobService();

    const launchService = new LaunchService({ campaignService, jobService });
    const result = launchService.launchCampaign('nonexistent');

    expect('error' in result).toBe(true);
  });
});
