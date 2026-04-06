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

  return { campaignService, jobService, launchService, statusService, controller };
}

function authRequest(overrides: Partial<{ params: Record<string, string>; body: unknown }> = {}) {
  return {
    session: { adminUser: { email: 'admin@example.com' } },
    ...overrides,
  };
}

describe('controller retryTarget endpoint', () => {
  test('POST /campaigns/:id/targets/:targetId/retry re-enqueues a failed job', async () => {
    const { controller, campaignService, jobService } = createFullStack();

    // Setup: create, add target, launch, fail the job
    const { campaign } = await campaignService.createCampaign({ title: 'Retry', videoAssetId: 'a1' });
    const { target } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1', videoTitle: 'V', videoDescription: 'D',
    });
    await campaignService.markReady(campaign.id);
    await campaignService.launch(campaign.id);
    const [job] = await jobService.enqueueForTargets([{ id: target.id, campaignId: campaign.id }]);
    await jobService.pickNext(); // processing
    await jobService.markFailed(job.id, 'quotaExceeded');
    await campaignService.updateTargetStatus(campaign.id, target.id, 'erro', { errorMessage: 'quotaExceeded' });

    const response = await controller.retryTarget(authRequest({
      params: { id: campaign.id, targetId: target.id },
    }));

    expect(response.status).toBe(200);
    expect(response.body.job!.status).toBe('queued');
    expect(response.body.job!.attempt).toBe(2);
  });

  test('retry returns 400 when max attempts reached', async () => {
    const { controller, campaignService, jobService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({ title: 'MaxRetry', videoAssetId: 'a1' });
    const { target } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1', videoTitle: 'V', videoDescription: 'D',
    });
    await campaignService.markReady(campaign.id);
    await campaignService.launch(campaign.id);
    const [job] = await jobService.enqueueForTargets([{ id: target.id, campaignId: campaign.id }]);

    // Exhaust all 3 attempts
    await jobService.pickNext();
    await jobService.markFailed(job.id, 'err');
    const r2 = await jobService.retry(job.id);
    if (!('error' in r2)) { await jobService.pickNext(); await jobService.markFailed(r2.id, 'err'); }
    const r3 = await jobService.retry(job.id);
    if (!('error' in r3)) { await jobService.pickNext(); await jobService.markFailed(r3.id, 'err'); }

    const response = await controller.retryTarget(authRequest({
      params: { id: campaign.id, targetId: target.id },
    }));

    expect(response.status).toBe(400);
  });

  test('retry returns 404 for nonexistent target', async () => {
    const { controller, campaignService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({ title: 'NoTarget', videoAssetId: 'a1' });

    const response = await controller.retryTarget(authRequest({
      params: { id: campaign.id, targetId: 'nope' },
    }));

    expect(response.status).toBe(404);
  });
});

describe('controller markReady endpoint', () => {
  test('POST /campaigns/:id/ready transitions draft to ready', async () => {
    const { controller, campaignService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({ title: 'ReadyUp', videoAssetId: 'a1' });
    await campaignService.addTarget(campaign.id, { channelId: 'ch-1', videoTitle: 'V', videoDescription: 'D' });

    const response = await controller.markReady(authRequest({
      params: { id: campaign.id },
    }));

    expect(response.status).toBe(200);
    expect(response.body.campaign!.status).toBe('ready');
  });

  test('markReady rejects campaign without targets', async () => {
    const { controller, campaignService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({ title: 'Empty', videoAssetId: 'a1' });

    const response = await controller.markReady(authRequest({
      params: { id: campaign.id },
    }));

    expect(response.status).toBe(400);
  });

  test('markReady returns 404 for nonexistent campaign', async () => {
    const { controller } = createFullStack();

    const response = await controller.markReady(authRequest({
      params: { id: 'nope' },
    }));

    expect(response.status).toBe(404);
  });
});
