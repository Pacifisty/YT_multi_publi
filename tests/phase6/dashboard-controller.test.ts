import { describe, expect, test } from 'vitest';

import { createCampaignsModule } from '../../apps/api/src/campaigns/campaigns.module';

describe('dashboard controller endpoint', () => {
  test('GET /dashboard returns stats via module', async () => {
    const mod = createCampaignsModule();

    // Seed data
    const { campaign } = mod.campaignService.createCampaign({ title: 'D1', videoAssetId: 'a1' });
    const { target } = mod.campaignService.addTarget(campaign.id, {
      channelId: 'ch-1', videoTitle: 'V1', videoDescription: 'D',
    });
    mod.campaignService.markReady(campaign.id);
    mod.launchService.launchCampaign(campaign.id);

    const request = {
      session: { adminUser: { email: 'admin@test.com' } },
    };

    const response = await mod.campaignsController.getDashboard(request);

    expect(response.status).toBe(200);
    expect(response.body.campaigns.total).toBe(1);
    expect(response.body.campaigns.byStatus.launching).toBe(1);
    expect(response.body.targets.total).toBe(1);
    expect(response.body.jobs.total).toBe(1);
  });

  test('GET /dashboard returns 401 without session', async () => {
    const mod = createCampaignsModule();

    const response = await mod.campaignsController.getDashboard({} as any);

    expect(response.status).toBe(401);
  });
});
