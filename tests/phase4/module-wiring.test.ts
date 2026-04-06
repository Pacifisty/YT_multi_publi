import { describe, expect, test } from 'vitest';

import { createCampaignsModule } from '../../apps/api/src/campaigns/campaigns.module';

describe('campaigns module wires all services', () => {
  test('module instance exposes all services', async () => {
    const mod = createCampaignsModule();

    expect(mod.campaignService).toBeDefined();
    expect(mod.campaignsController).toBeDefined();
    expect(mod.sessionGuard).toBeDefined();
    expect(mod.jobService).toBeDefined();
    expect(mod.launchService).toBeDefined();
    expect(mod.statusService).toBeDefined();
  });

  test('controller launch uses LaunchService (enqueues jobs)', async () => {
    const mod = createCampaignsModule();

    const { campaign } = await mod.campaignService.createCampaign({ title: 'Wire Test', videoAssetId: 'a1' });
    await mod.campaignService.addTarget(campaign.id, { channelId: 'ch-1', videoTitle: 'V', videoDescription: 'D' });
    await mod.campaignService.markReady(campaign.id);

    const request = {
      session: { adminUser: { email: 'admin@test.com' } },
      params: { id: campaign.id },
    };

    const response = await mod.campaignsController.launch(request);
    expect(response.status).toBe(200);

    // Jobs should have been enqueued via LaunchService
    const target = response.body.campaign!.targets[0];
    const jobs = await mod.jobService.getJobsForTarget(target.id);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe('queued');
  });

  test('controller getStatus returns live data', async () => {
    const mod = createCampaignsModule();

    const { campaign } = await mod.campaignService.createCampaign({ title: 'Status Wire', videoAssetId: 'a1' });
    await mod.campaignService.addTarget(campaign.id, { channelId: 'ch-1', videoTitle: 'V', videoDescription: 'D' });
    await mod.campaignService.markReady(campaign.id);
    await mod.campaignService.launch(campaign.id);

    const request = {
      session: { adminUser: { email: 'admin@test.com' } },
      params: { id: campaign.id },
    };

    const response = await mod.campaignsController.getStatus(request);
    expect(response.status).toBe(200);
    expect(response.body.campaignStatus).toBe('launching');
    expect(response.body.shouldPoll).toBe(true);
  });
});
