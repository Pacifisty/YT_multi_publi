import { describe, expect, test } from 'vitest';

import { CampaignsController } from '../../apps/api/src/campaigns/campaigns.controller';
import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';
import { SessionGuard } from '../../apps/api/src/auth/session.guard';

function createAuthenticatedRequest() {
  return {
    session: {
      adminUser: { email: 'admin@example.com' },
    },
  };
}

describe('campaign target privacy validation', () => {
  test('POST /campaigns/:id/targets rejects unsupported privacy values', async () => {
    const repository = new InMemoryCampaignRepository();
    const service = new CampaignService({ repository });
    const controller = new CampaignsController(service, new SessionGuard());

    const { campaign } = await service.createCampaign({ title: 'Camp', videoAssetId: 'asset-1' });

    const response = await controller.addTarget({
      ...createAuthenticatedRequest(),
      params: { id: campaign.id },
      body: {
        channelId: 'channel-1',
        videoTitle: 'Test Video',
        videoDescription: 'Test Desc',
        privacy: 'friends-only',
      },
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: expect.stringContaining('privacy') });
  });

  test('PATCH /campaigns/:id/targets trims and accepts supported privacy values only', async () => {
    const repository = new InMemoryCampaignRepository();
    const service = new CampaignService({ repository });
    const controller = new CampaignsController(service, new SessionGuard());

    const { campaign } = await service.createCampaign({ title: 'Camp', videoAssetId: 'asset-1' });
    const { target } = await service.addTarget(campaign.id, {
      channelId: 'channel-1',
      videoTitle: 'Original Title',
      videoDescription: 'Original Desc',
    });

    const response = await controller.updateTarget({
      ...createAuthenticatedRequest(),
      params: { id: campaign.id, targetId: target.id },
      body: {
        privacy: '  public  ',
      },
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      target: {
        privacy: 'public',
      },
    });
  });
});
