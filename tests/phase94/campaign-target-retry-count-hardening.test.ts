import { describe, expect, test } from 'vitest';

import { CampaignsController } from '../../apps/api/src/campaigns/campaigns.controller';
import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';
import { PublishJobService, InMemoryPublishJobRepository } from '../../apps/api/src/campaigns/publish-job.service';
import { LaunchService } from '../../apps/api/src/campaigns/launch.service';
import { CampaignStatusService } from '../../apps/api/src/campaigns/campaign-status.service';
import { SessionGuard } from '../../apps/api/src/auth/session.guard';

function createFullStack() {
  const campaignRepo = new InMemoryCampaignRepository();
  const campaignService = new CampaignService({ repository: campaignRepo });
  const jobRepo = new InMemoryPublishJobRepository();
  const jobService = new PublishJobService({ repository: jobRepo, maxAttempts: 3 });
  const launchService = new LaunchService({ campaignService, jobService });
  const statusService = new CampaignStatusService({ campaignService, jobService });
  const controller = new CampaignsController(
    campaignService,
    new SessionGuard(),
    launchService,
    statusService,
    jobService,
  );

  return { campaignService, jobService, controller, launchService };
}

function authRequest(overrides: Partial<{ params: Record<string, string>; body: unknown }> = {}) {
  return {
    session: { adminUser: { email: 'admin@example.com' } },
    ...overrides,
  };
}

describe('campaign target retry count hardening', () => {
  test('retryTarget increments the persisted target retryCount when a failed target is re-queued', async () => {
    const { controller, campaignService, jobService, launchService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({ title: 'Retry Count', videoAssetId: 'asset-1' });
    const { target } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'Video',
      videoDescription: 'Desc',
    });
    await campaignService.markReady(campaign.id);
    await launchService.launchCampaign(campaign.id);

    const [job] = await jobService.getJobsForTarget(target.id);
    await jobService.pickNext();
    await jobService.markFailed(job.id, 'quotaExceeded');
    await campaignService.updateTargetStatus(campaign.id, target.id, 'erro', { errorMessage: 'quotaExceeded' });

    const response = await controller.retryTarget(authRequest({
      params: { id: campaign.id, targetId: target.id },
    }));

    expect(response.status).toBe(200);

    const persisted = await campaignService.getCampaign(campaign.id);
    expect(persisted!.campaign.targets[0]).toMatchObject({
      status: 'aguardando',
      errorMessage: null,
      retryCount: 1,
    });
  });

  test('retryTarget keeps incrementing retryCount across multiple retries', async () => {
    const { controller, campaignService, jobService, launchService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({ title: 'Retry Count Loop', videoAssetId: 'asset-1' });
    const { target } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'Video',
      videoDescription: 'Desc',
    });
    await campaignService.markReady(campaign.id);
    await launchService.launchCampaign(campaign.id);

    const [job] = await jobService.getJobsForTarget(target.id);

    await jobService.pickNext();
    await jobService.markFailed(job.id, 'first error');
    await campaignService.updateTargetStatus(campaign.id, target.id, 'erro', { errorMessage: 'first error' });
    await controller.retryTarget(authRequest({ params: { id: campaign.id, targetId: target.id } }));

    await jobService.pickNext();
    await jobService.markFailed(job.id, 'second error');
    await campaignService.updateTargetStatus(campaign.id, target.id, 'erro', { errorMessage: 'second error' });
    const response = await controller.retryTarget(authRequest({ params: { id: campaign.id, targetId: target.id } }));

    expect(response.status).toBe(200);
    expect(response.body.job!.attempt).toBe(3);

    const persisted = await campaignService.getCampaign(campaign.id);
    expect(persisted!.campaign.targets[0].retryCount).toBe(2);
  });
});
