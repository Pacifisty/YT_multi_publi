import { describe, expect, it } from 'vitest';
import { createApiRouter } from '../../apps/api/src/router';
import { createCampaignsModule } from '../../apps/api/src/campaigns/campaigns.module';
import type { ApiRequest } from '../../apps/api/src/router';

const authedSession = () => ({ adminUser: { email: 'admin@test.com' } });

function setup() {
  const campaignsModule = createCampaignsModule();
  const { campaignService } = campaignsModule;
  const router = createApiRouter({ campaignsModule });
  return { campaignService, router };
}

async function seedMany(campaignService: ReturnType<typeof setup>['campaignService'], count: number) {
  for (let i = 0; i < count; i++) {
    await campaignService.createCampaign({ title: `Campaign ${i + 1}`, videoAssetId: `v-${i + 1}` });
  }
}

describe('campaign list query hardening', () => {
  it('falls back to safe defaults when limit and offset are non-numeric', async () => {
    const { campaignService, router } = setup();
    await seedMany(campaignService, 3);

    const request: ApiRequest = {
      method: 'GET',
      path: '/api/campaigns',
      session: authedSession(),
      query: { limit: 'abc', offset: 'oops' },
    };

    const response = await router.handle(request);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(3);
    expect(response.body.limit).toBe(20);
    expect(response.body.offset).toBe(0);
    expect(response.body.campaigns).toHaveLength(3);
  });

  it('does not silently truncate malformed integer-like pagination values', async () => {
    const { campaignService, router } = setup();
    await seedMany(campaignService, 5);

    const request: ApiRequest = {
      method: 'GET',
      path: '/api/campaigns',
      session: authedSession(),
      query: { limit: '2items', offset: '1.5' },
    };

    const response = await router.handle(request);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(5);
    expect(response.body.limit).toBe(20);
    expect(response.body.offset).toBe(0);
    expect(response.body.campaigns).toHaveLength(5);
  });
});
