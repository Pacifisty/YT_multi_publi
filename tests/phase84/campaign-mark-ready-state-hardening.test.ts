import { describe, expect, test } from 'vitest';

import { CampaignsController } from '../../apps/api/src/campaigns/campaigns.controller';
import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';
import { SessionGuard } from '../../apps/api/src/auth/session.guard';

function authRequest(params: Record<string, string>) {
  return {
    session: { adminUser: { email: 'admin@example.com' } },
    params,
  };
}

function createController() {
  const campaignService = new CampaignService({ repository: new InMemoryCampaignRepository() });
  const controller = new CampaignsController(campaignService, new SessionGuard());
  return { campaignService, controller };
}

describe('campaign markReady state hardening', () => {
  test('POST /campaigns/:id/ready rejects campaigns that are already ready', async () => {
    const { campaignService, controller } = createController();

    const { campaign } = await campaignService.createCampaign({ title: 'Ready Once', videoAssetId: 'a1' });
    await campaignService.addTarget(campaign.id, { channelId: 'ch-1', videoTitle: 'V', videoDescription: 'D' });
    await campaignService.markReady(campaign.id);

    const response = await controller.markReady(authRequest({ id: campaign.id }));

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Cannot mark ready');
  });

  test('POST /campaigns/:id/ready rejects launching campaigns', async () => {
    const { campaignService, controller } = createController();

    const { campaign } = await campaignService.createCampaign({ title: 'Launching', videoAssetId: 'a1' });
    await campaignService.addTarget(campaign.id, { channelId: 'ch-1', videoTitle: 'V', videoDescription: 'D' });
    await campaignService.markReady(campaign.id);
    await campaignService.launch(campaign.id);

    const response = await controller.markReady(authRequest({ id: campaign.id }));

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Cannot mark ready');
  });
});
