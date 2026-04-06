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

describe('campaign title whitespace hardening', () => {
  test('PATCH /campaigns/:id rejects a whitespace-only title update', async () => {
    const repository = new InMemoryCampaignRepository();
    const service = new CampaignService({ repository });
    const controller = new CampaignsController(service, new SessionGuard());

    const { campaign } = await service.createCampaign({ title: 'Original Title', videoAssetId: 'asset-1' });

    const response = await controller.update({
      ...createAuthenticatedRequest(),
      params: { id: campaign.id },
      body: { title: '   ' },
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: expect.stringContaining('title') });

    const persisted = await service.getCampaign(campaign.id);
    expect(persisted?.campaign.title).toBe('Original Title');
  });

  test('PATCH /campaigns/:id trims surrounding whitespace from a valid title update', async () => {
    const repository = new InMemoryCampaignRepository();
    const service = new CampaignService({ repository });
    const controller = new CampaignsController(service, new SessionGuard());

    const { campaign } = await service.createCampaign({ title: 'Original Title', videoAssetId: 'asset-1' });

    const response = await controller.update({
      ...createAuthenticatedRequest(),
      params: { id: campaign.id },
      body: { title: '  Updated Title  ' },
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      campaign: { title: 'Updated Title' },
    });
  });
});
