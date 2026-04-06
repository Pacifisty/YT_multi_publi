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

describe('campaign post-completion mutation hardening', () => {
  test('PATCH /campaigns/:id rejects updates after the campaign is completed', async () => {
    const { campaignService, controller } = createController();

    const { campaign } = await campaignService.createCampaign({ title: 'Completed', videoAssetId: 'asset-1' });
    const { target } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'Video',
      videoDescription: 'Desc',
    });
    await campaignService.markReady(campaign.id);
    await campaignService.launch(campaign.id);
    await campaignService.updateTargetStatus(campaign.id, target.id, 'publicado', { youtubeVideoId: 'yt-1' });

    const response = await controller.update(authRequest({
      params: { id: campaign.id },
      body: { title: 'Changed After Completion' },
    }));

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Cannot update');
  });

  test('DELETE /campaigns/:id rejects deletion after the campaign has failed', async () => {
    const { campaignService, controller } = createController();

    const { campaign } = await campaignService.createCampaign({ title: 'Failed', videoAssetId: 'asset-1' });
    const { target } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'Video',
      videoDescription: 'Desc',
    });
    await campaignService.markReady(campaign.id);
    await campaignService.launch(campaign.id);
    await campaignService.updateTargetStatus(campaign.id, target.id, 'erro', { errorMessage: 'upload failed' });

    const response = await controller.deleteCampaign(authRequest({
      params: { id: campaign.id },
    }));

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Cannot delete');
  });
});
