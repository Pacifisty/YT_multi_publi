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

function seedCampaigns(campaignService: ReturnType<typeof setup>['campaignService']) {
  const c1 = campaignService.createCampaign({ title: 'Alpha Video', videoAssetId: 'v-1' }).campaign;
  const c2 = campaignService.createCampaign({ title: 'Beta Launch', videoAssetId: 'v-2' }).campaign;
  const c3 = campaignService.createCampaign({ title: 'Gamma Release', videoAssetId: 'v-3' }).campaign;

  // Make c2 ready
  campaignService.addTarget(c2.id, { channelId: 'ch-1', videoTitle: 'T', videoDescription: 'D' });
  campaignService.markReady(c2.id);

  // Make c3 completed by launching and completing targets
  campaignService.addTarget(c3.id, { channelId: 'ch-2', videoTitle: 'T', videoDescription: 'D' });
  campaignService.markReady(c3.id);
  campaignService.launch(c3.id);

  return { c1, c2, c3 };
}

describe('Campaign List Filtering', () => {
  describe('GET /api/campaigns?status=', () => {
    it('filters by draft status', async () => {
      const { campaignService, router } = setup();
      seedCampaigns(campaignService);

      const request: ApiRequest = {
        method: 'GET',
        path: '/api/campaigns',
        session: authedSession(),
        query: { status: 'draft' },
      };

      const response = await router.handle(request);
      expect(response.status).toBe(200);
      expect(response.body.campaigns).toHaveLength(1);
      expect(response.body.campaigns[0].title).toBe('Alpha Video');
    });

    it('filters by ready status', async () => {
      const { campaignService, router } = setup();
      seedCampaigns(campaignService);

      const request: ApiRequest = {
        method: 'GET',
        path: '/api/campaigns',
        session: authedSession(),
        query: { status: 'ready' },
      };

      const response = await router.handle(request);
      expect(response.status).toBe(200);
      expect(response.body.campaigns).toHaveLength(1);
      expect(response.body.campaigns[0].title).toBe('Beta Launch');
    });

    it('filters by launching status', async () => {
      const { campaignService, router } = setup();
      seedCampaigns(campaignService);

      const request: ApiRequest = {
        method: 'GET',
        path: '/api/campaigns',
        session: authedSession(),
        query: { status: 'launching' },
      };

      const response = await router.handle(request);
      expect(response.status).toBe(200);
      expect(response.body.campaigns).toHaveLength(1);
      expect(response.body.campaigns[0].title).toBe('Gamma Release');
    });
  });

  describe('GET /api/campaigns?search=', () => {
    it('filters by title substring (case-insensitive)', async () => {
      const { campaignService, router } = setup();
      seedCampaigns(campaignService);

      const request: ApiRequest = {
        method: 'GET',
        path: '/api/campaigns',
        session: authedSession(),
        query: { search: 'beta' },
      };

      const response = await router.handle(request);
      expect(response.status).toBe(200);
      expect(response.body.campaigns).toHaveLength(1);
      expect(response.body.campaigns[0].title).toBe('Beta Launch');
    });

    it('returns empty array when no match', async () => {
      const { campaignService, router } = setup();
      seedCampaigns(campaignService);

      const request: ApiRequest = {
        method: 'GET',
        path: '/api/campaigns',
        session: authedSession(),
        query: { search: 'nonexistent' },
      };

      const response = await router.handle(request);
      expect(response.status).toBe(200);
      expect(response.body.campaigns).toHaveLength(0);
    });
  });

  describe('combined filters', () => {
    it('combines status and search filters', async () => {
      const { campaignService, router } = setup();
      seedCampaigns(campaignService);

      const request: ApiRequest = {
        method: 'GET',
        path: '/api/campaigns',
        session: authedSession(),
        query: { status: 'draft', search: 'alpha' },
      };

      const response = await router.handle(request);
      expect(response.status).toBe(200);
      expect(response.body.campaigns).toHaveLength(1);
    });

    it('returns empty when status matches but search does not', async () => {
      const { campaignService, router } = setup();
      seedCampaigns(campaignService);

      const request: ApiRequest = {
        method: 'GET',
        path: '/api/campaigns',
        session: authedSession(),
        query: { status: 'draft', search: 'beta' },
      };

      const response = await router.handle(request);
      expect(response.status).toBe(200);
      expect(response.body.campaigns).toHaveLength(0);
    });
  });

  describe('no filters', () => {
    it('returns all campaigns when no query params', async () => {
      const { campaignService, router } = setup();
      seedCampaigns(campaignService);

      const request: ApiRequest = {
        method: 'GET',
        path: '/api/campaigns',
        session: authedSession(),
      };

      const response = await router.handle(request);
      expect(response.status).toBe(200);
      expect(response.body.campaigns).toHaveLength(3);
    });
  });

  describe('auth', () => {
    it('returns 401 without session', async () => {
      const { router } = setup();

      const request: ApiRequest = {
        method: 'GET',
        path: '/api/campaigns',
        session: null,
        query: { status: 'draft' },
      };

      const response = await router.handle(request);
      expect(response.status).toBe(401);
    });
  });
});
