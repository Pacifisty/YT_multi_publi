import { describe, expect, test } from 'vitest';

import { CampaignsController } from '../../apps/api/src/campaigns/campaigns.controller';
import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';
import { SessionGuard } from '../../apps/api/src/auth/session.guard';

function authRequest(overrides: {
  body?: unknown;
  params?: Record<string, string>;
} = {}) {
  return {
    session: { adminUser: { email: 'admin@example.com' } },
    body: overrides.body,
    params: overrides.params,
  };
}

describe('campaign target playlistId hardening', () => {
  test('POST /campaigns/:id/targets rejects a whitespace-only playlistId', async () => {
    const service = new CampaignService({ repository: new InMemoryCampaignRepository() });
    const controller = new CampaignsController(service, new SessionGuard());

    const { campaign } = await service.createCampaign({
      title: 'Playlist hardening',
      videoAssetId: 'asset-1',
    });

    const response = await controller.addTarget(authRequest({
      params: { id: campaign.id },
      body: {
        channelId: 'channel-1',
        videoTitle: 'Video',
        videoDescription: 'Description',
        playlistId: '   ',
      },
    }));

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: expect.stringContaining('playlistId') });

    const persisted = await service.getCampaign(campaign.id);
    expect(persisted?.campaign.targets).toHaveLength(0);
  });

  test('PATCH /campaigns/:id/targets trims a valid playlistId before saving', async () => {
    const service = new CampaignService({ repository: new InMemoryCampaignRepository() });
    const controller = new CampaignsController(service, new SessionGuard());

    const { campaign } = await service.createCampaign({
      title: 'Playlist hardening',
      videoAssetId: 'asset-1',
    });

    const { target } = await service.addTarget(campaign.id, {
      channelId: 'channel-1',
      videoTitle: 'Video',
      videoDescription: 'Description',
    });

    const response = await controller.updateTarget(authRequest({
      params: { id: campaign.id, targetId: target.id },
      body: {
        playlistId: '  playlist-123  ',
      },
    }));

    expect(response.status).toBe(200);
    expect(response.body.target).toMatchObject({
      playlistId: 'playlist-123',
    });
  });
});
