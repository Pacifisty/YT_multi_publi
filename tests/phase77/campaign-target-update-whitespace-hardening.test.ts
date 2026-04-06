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

describe('campaign target update whitespace hardening', () => {
  test('PATCH /campaigns/:id/targets rejects whitespace-only text field updates', async () => {
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
        videoTitle: '   ',
        videoDescription: '\t',
      },
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: expect.stringContaining('blank') });

    const persisted = await service.getCampaign(campaign.id);
    expect(persisted?.campaign.targets[0]).toMatchObject({
      videoTitle: 'Original Title',
      videoDescription: 'Original Desc',
    });
  });

  test('PATCH /campaigns/:id/targets trims valid text field updates before saving', async () => {
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
        videoTitle: '  Updated Title  ',
        videoDescription: '  Updated Desc  ',
      },
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      target: {
        videoTitle: 'Updated Title',
        videoDescription: 'Updated Desc',
      },
    });
  });
});
