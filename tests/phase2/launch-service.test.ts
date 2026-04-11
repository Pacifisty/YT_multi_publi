import { describe, expect, test, vi } from 'vitest';

import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';
import { PublishJobService, InMemoryPublishJobRepository } from '../../apps/api/src/campaigns/publish-job.service';
import { LaunchService } from '../../apps/api/src/campaigns/launch.service';

describe('launch service', () => {
  test('transitions campaign to launching and enqueues one job per target', async () => {
    const campaignRepo = new InMemoryCampaignRepository();
    const campaignService = new CampaignService({ repository: campaignRepo });
    const jobRepo = new InMemoryPublishJobRepository();
    const jobService = new PublishJobService({ repository: jobRepo });

    const { campaign } = await campaignService.createCampaign({
      title: 'Launch Test',
      videoAssetId: 'asset-1',
    });

    await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'V1',
      videoDescription: 'D1',
    });
    await campaignService.addTarget(campaign.id, {
      channelId: 'ch-2',
      videoTitle: 'V2',
      videoDescription: 'D2',
    });

    await campaignService.markReady(campaign.id);

    const launchService = new LaunchService({ campaignService, jobService });
    const result = await launchService.launchCampaign(campaign.id);

    expect('campaign' in result).toBe(true);
    if ('campaign' in result) {
      expect(result.campaign.status).toBe('launching');

      // One job per target
      const t1Jobs = await jobService.getJobsForTarget(result.campaign.targets[0].id);
      const t2Jobs = await jobService.getJobsForTarget(result.campaign.targets[1].id);
      expect(t1Jobs).toHaveLength(1);
      expect(t2Jobs).toHaveLength(1);
      expect(t1Jobs[0].status).toBe('queued');
    }
  });

  test('rejects launch for draft campaign', async () => {
    const campaignRepo = new InMemoryCampaignRepository();
    const campaignService = new CampaignService({ repository: campaignRepo });
    const jobRepo = new InMemoryPublishJobRepository();
    const jobService = new PublishJobService({ repository: jobRepo });

    const { campaign } = await campaignService.createCampaign({
      title: 'Draft',
      videoAssetId: 'asset-1',
    });

    const launchService = new LaunchService({ campaignService, jobService });
    const result = await launchService.launchCampaign(campaign.id);

    expect('error' in result).toBe(true);
  });

  test('rejects launch for non-existent campaign', async () => {
    const campaignService = new CampaignService();
    const jobService = new PublishJobService();

    const launchService = new LaunchService({ campaignService, jobService });
    const result = await launchService.launchCampaign('nonexistent');

    expect('error' in result).toBe(true);
  });

  test('enqueues only targets that are due at launch time', async () => {
    const now = new Date('2026-04-10T16:00:00Z');
    const campaignRepo = new InMemoryCampaignRepository();
    const campaignService = new CampaignService({ repository: campaignRepo });
    const jobRepo = new InMemoryPublishJobRepository();
    const jobService = new PublishJobService({ repository: jobRepo });

    const { campaign } = await campaignService.createCampaign({
      title: 'Scheduled Fan-Out',
      videoAssetId: 'asset-1',
    });

    const { target: immediateTarget } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'Immediate',
      videoDescription: 'Run now',
    });
    const { target: futureTarget } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-2',
      videoTitle: 'Future',
      videoDescription: 'Run later',
      publishAt: '2026-04-10T17:00:00Z',
    });

    await campaignService.markReady(campaign.id);

    const launchService = new LaunchService({ campaignService, jobService, now: () => now });
    const result = await launchService.launchCampaign(campaign.id);

    expect('campaign' in result).toBe(true);
    if ('campaign' in result) {
      expect(result.campaign.status).toBe('launching');

      const immediateJobs = await jobService.getJobsForTarget(immediateTarget.id);
      const futureJobs = await jobService.getJobsForTarget(futureTarget.id);
      expect(immediateJobs).toHaveLength(1);
      expect(futureJobs).toHaveLength(0);
    }
  });
});
