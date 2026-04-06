import { describe, expect, test } from 'vitest';

import { CampaignsController } from '../../apps/api/src/campaigns/campaigns.controller';
import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';
import { SessionGuard } from '../../apps/api/src/auth/session.guard';

function createController() {
  const campaignService = new CampaignService({ repository: new InMemoryCampaignRepository() });
  const controller = new CampaignsController(campaignService, new SessionGuard());
  return { campaignService, controller };
}

function authRequest(overrides: Partial<{ params: Record<string, string>; body: unknown }> = {}) {
  return {
    session: { adminUser: { email: 'admin@example.com' } },
    ...overrides,
  };
}

describe('campaign launching target mutation hardening', () => {
  test('PATCH /campaigns/:id/targets/:targetId rejects updates after launch', async () => {
    const { campaignService, controller } = createController();

    const { campaign } = await campaignService.createCampaign({ title: 'Live', videoAssetId: 'asset-1' });
    const { target } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'Original',
      videoDescription: 'Desc',
    });
    await campaignService.markReady(campaign.id);
    await campaignService.launch(campaign.id);

    const response = await controller.updateTarget(authRequest({
      params: { id: campaign.id, targetId: target.id },
      body: { videoTitle: 'Changed After Launch' },
    }));

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Cannot update');
  });

  test('DELETE /campaigns/:id/targets/:targetId rejects removal after launch', async () => {
    const { campaignService, controller } = createController();

    const { campaign } = await campaignService.createCampaign({ title: 'Live', videoAssetId: 'asset-1' });
    const { target } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'Original',
      videoDescription: 'Desc',
    });
    await campaignService.markReady(campaign.id);
    await campaignService.launch(campaign.id);

    const response = await controller.removeTarget(authRequest({
      params: { id: campaign.id, targetId: target.id },
    }));

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Cannot remove');
  });
});
