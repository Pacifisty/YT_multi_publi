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

describe('ready campaign last-target removal hardening', () => {
  test('removing the final target demotes a ready campaign back to draft', async () => {
    const { campaignService, controller } = createController();

    const { campaign } = await campaignService.createCampaign({ title: 'Ready Campaign', videoAssetId: 'asset-1' });
    const { target } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'Video',
      videoDescription: 'Desc',
    });
    await campaignService.markReady(campaign.id);

    const response = await controller.removeTarget(authRequest({
      params: { id: campaign.id, targetId: target.id },
    }));

    expect(response.status).toBe(200);

    const updated = await campaignService.getCampaign(campaign.id);
    expect(updated!.campaign.targets).toHaveLength(0);
    expect(updated!.campaign.status).toBe('draft');
  });

  test('launch rejects a campaign whose last target was removed after markReady', async () => {
    const { campaignService, controller } = createController();

    const { campaign } = await campaignService.createCampaign({ title: 'Ready Campaign', videoAssetId: 'asset-1' });
    const { target } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'Video',
      videoDescription: 'Desc',
    });
    await campaignService.markReady(campaign.id);
    await controller.removeTarget(authRequest({
      params: { id: campaign.id, targetId: target.id },
    }));

    const response = await controller.launch(authRequest({
      params: { id: campaign.id },
    }));

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Cannot launch');
  });
});
