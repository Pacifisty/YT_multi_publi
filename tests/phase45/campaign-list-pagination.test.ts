import { describe, it, expect } from 'vitest';
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

function seedMany(campaignService: ReturnType<typeof setup>['campaignService'], count: number) {
  const campaigns = [];
  for (let i = 0; i < count; i++) {
    const result = campaignService.createCampaign({ title: `Campaign ${i + 1}`, videoAssetId: `v-${i + 1}` });
    campaigns.push(result.campaign);
  }
  return campaigns;
}

describe('Campaign List Pagination', () => {
  describe('response envelope', () => {
    it('returns total, limit, and offset in response', async () => {
      const { campaignService, router } = setup();
      seedMany(campaignService, 3);

      const request: ApiRequest = {
        method: 'GET',
        path: '/api/campaigns',
        session: authedSession(),
      };

      const response = await router.handle(request);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('total', 3);
      expect(response.body).toHaveProperty('limit', 20);
      expect(response.body).toHaveProperty('offset', 0);
      expect(response.body.campaigns).toHaveLength(3);
    });
  });

  describe('limit', () => {
    it('limits results to specified count', async () => {
      const { campaignService, router } = setup();
      seedMany(campaignService, 5);

      const request: ApiRequest = {
        method: 'GET',
        path: '/api/campaigns',
        session: authedSession(),
        query: { limit: '2' },
      };

      const response = await router.handle(request);
      expect(response.status).toBe(200);
      expect(response.body.campaigns).toHaveLength(2);
      expect(response.body.total).toBe(5);
      expect(response.body.limit).toBe(2);
      expect(response.body.offset).toBe(0);
    });

    it('defaults to 20 when not specified', async () => {
      const { campaignService, router } = setup();
      seedMany(campaignService, 25);

      const request: ApiRequest = {
        method: 'GET',
        path: '/api/campaigns',
        session: authedSession(),
      };

      const response = await router.handle(request);
      expect(response.body.campaigns).toHaveLength(20);
      expect(response.body.total).toBe(25);
    });
  });

  describe('offset', () => {
    it('skips items by offset', async () => {
      const { campaignService, router } = setup();
      seedMany(campaignService, 5);

      const request: ApiRequest = {
        method: 'GET',
        path: '/api/campaigns',
        session: authedSession(),
        query: { limit: '10', offset: '2' },
      };

      const response = await router.handle(request);
      expect(response.body.campaigns).toHaveLength(3);
      expect(response.body.offset).toBe(2);
      expect(response.body.total).toBe(5);
    });

    it('returns empty when offset exceeds total', async () => {
      const { campaignService, router } = setup();
      seedMany(campaignService, 3);

      const request: ApiRequest = {
        method: 'GET',
        path: '/api/campaigns',
        session: authedSession(),
        query: { offset: '10' },
      };

      const response = await router.handle(request);
      expect(response.body.campaigns).toHaveLength(0);
      expect(response.body.total).toBe(3);
    });
  });

  describe('pagination with filters', () => {
    it('applies pagination after status filter', async () => {
      const { campaignService, router } = setup();
      seedMany(campaignService, 5);
      // Make campaigns 3 and 4 ready
      const all = campaignService.listCampaigns();
      const drafts = all.campaigns.filter((c) => c.status === 'draft');
      // add target + markReady on first two drafts (newest first, so index 0 and 1)
      for (const c of [drafts[0], drafts[1]]) {
        campaignService.addTarget(c.id, { channelId: 'ch-1', videoTitle: 'T', videoDescription: 'D' });
        campaignService.markReady(c.id);
      }

      const request: ApiRequest = {
        method: 'GET',
        path: '/api/campaigns',
        session: authedSession(),
        query: { status: 'draft', limit: '2', offset: '0' },
      };

      const response = await router.handle(request);
      // 5 total, 2 made ready, 3 remain draft
      expect(response.body.total).toBe(3);
      expect(response.body.campaigns).toHaveLength(2);
    });

    it('applies pagination after search filter', async () => {
      const { campaignService, router } = setup();
      campaignService.createCampaign({ title: 'Alpha One', videoAssetId: 'v-1' });
      campaignService.createCampaign({ title: 'Alpha Two', videoAssetId: 'v-2' });
      campaignService.createCampaign({ title: 'Alpha Three', videoAssetId: 'v-3' });
      campaignService.createCampaign({ title: 'Beta One', videoAssetId: 'v-4' });

      const request: ApiRequest = {
        method: 'GET',
        path: '/api/campaigns',
        session: authedSession(),
        query: { search: 'alpha', limit: '2', offset: '1' },
      };

      const response = await router.handle(request);
      expect(response.body.total).toBe(3);
      expect(response.body.campaigns).toHaveLength(2);
    });
  });

  describe('edge cases', () => {
    it('clamps negative offset to 0', async () => {
      const { campaignService, router } = setup();
      seedMany(campaignService, 3);

      const request: ApiRequest = {
        method: 'GET',
        path: '/api/campaigns',
        session: authedSession(),
        query: { offset: '-5' },
      };

      const response = await router.handle(request);
      expect(response.body.offset).toBe(0);
      expect(response.body.campaigns).toHaveLength(3);
    });

    it('clamps limit to minimum 1', async () => {
      const { campaignService, router } = setup();
      seedMany(campaignService, 3);

      const request: ApiRequest = {
        method: 'GET',
        path: '/api/campaigns',
        session: authedSession(),
        query: { limit: '0' },
      };

      const response = await router.handle(request);
      expect(response.body.limit).toBe(1);
      expect(response.body.campaigns).toHaveLength(1);
    });

    it('clamps limit to maximum 100', async () => {
      const { campaignService, router } = setup();
      seedMany(campaignService, 3);

      const request: ApiRequest = {
        method: 'GET',
        path: '/api/campaigns',
        session: authedSession(),
        query: { limit: '500' },
      };

      const response = await router.handle(request);
      expect(response.body.limit).toBe(100);
    });
  });
});
