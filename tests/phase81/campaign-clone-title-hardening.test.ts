import { describe, expect, test } from 'vitest';

import { createApiRouter } from '../../apps/api/src/router';
import { createCampaignsModule } from '../../apps/api/src/campaigns/campaigns.module';

const authedSession = { adminUser: { email: 'admin@test.com' } };

function setup() {
  const campaignsModule = createCampaignsModule();
  const router = createApiRouter({ campaignsModule });
  return { campaignService: campaignsModule.campaignService, router };
}

describe('campaign clone title hardening', () => {
  test('POST /api/campaigns/:id/clone rejects a whitespace-only custom title', async () => {
    const { campaignService, router } = setup();
    const { campaign } = await campaignService.createCampaign({
      title: 'Original Campaign',
      videoAssetId: 'asset-1',
    });

    const response = await router.handle({
      method: 'POST',
      path: `/api/campaigns/${campaign.id}/clone`,
      session: authedSession,
      body: { title: '   ' },
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: expect.stringContaining('title') });
  });

  test('POST /api/campaigns/:id/clone trims a valid custom title override', async () => {
    const { campaignService, router } = setup();
    const { campaign } = await campaignService.createCampaign({
      title: 'Original Campaign',
      videoAssetId: 'asset-1',
    });

    const response = await router.handle({
      method: 'POST',
      path: `/api/campaigns/${campaign.id}/clone`,
      session: authedSession,
      body: { title: '  My Trimmed Clone  ' },
    });

    expect(response.status).toBe(201);
    expect(response.body.campaign.title).toBe('My Trimmed Clone');
  });
});
