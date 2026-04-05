import { describe, it, expect } from 'vitest';
import { createApiRouter } from '../../apps/api/src/router';
import { createCampaignsModule } from '../../apps/api/src/campaigns/campaigns.module';
import { createAuthModule } from '../../apps/api/src/auth/auth.module';
import type { ApiRequest } from '../../apps/api/src/router';

const authedSession = () => ({ adminUser: { email: 'admin@test.com' } });

function setup() {
  const authModule = createAuthModule({
    env: {
      ADMIN_EMAIL: 'admin@test.com',
      ADMIN_PASSWORD_HASH: '$2b$10$invalidhashfortesting',
    },
  });
  const campaignsModule = createCampaignsModule();
  const router = createApiRouter({
    campaignsModule,
    authController: authModule.authController,
  });
  return { authModule, campaignsModule, router };
}

describe('App Route Consolidation', () => {
  describe('Auth routes in router', () => {
    it('POST /auth/login returns 401 for invalid credentials', async () => {
      const { router } = setup();
      const request: ApiRequest = {
        method: 'POST',
        path: '/auth/login',
        session: null,
        body: { email: 'wrong@test.com', password: 'wrong' },
      };

      const response = await router.handle(request);
      expect(response.status).toBe(401);
    });

    it('POST /auth/logout returns 200 with cookies', async () => {
      const { router } = setup();
      const request: ApiRequest = {
        method: 'POST',
        path: '/auth/logout',
        session: authedSession(),
      };

      const response = await router.handle(request);
      expect(response.status).toBe(200);
      expect(response.cookies).toBeDefined();
      expect(response.cookies!.length).toBeGreaterThan(0);
    });

    it('GET /auth/me returns 401 without session', async () => {
      const { router } = setup();
      const request: ApiRequest = {
        method: 'GET',
        path: '/auth/me',
        session: null,
      };

      const response = await router.handle(request);
      expect(response.status).toBe(401);
    });

    it('GET /auth/me returns user with valid session', async () => {
      const { router } = setup();
      const request: ApiRequest = {
        method: 'GET',
        path: '/auth/me',
        session: authedSession(),
      };

      const response = await router.handle(request);
      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe('admin@test.com');
    });
  });

  describe('POST /api/campaigns/:id/targets in router', () => {
    it('adds a target and returns 201', async () => {
      const { campaignsModule, router } = setup();
      const { campaign } = campaignsModule.campaignService.createCampaign({
        title: 'Test',
        videoAssetId: 'v-1',
      });

      const request: ApiRequest = {
        method: 'POST',
        path: `/api/campaigns/${campaign.id}/targets`,
        session: authedSession(),
        body: {
          channelId: 'ch-1',
          videoTitle: 'Title',
          videoDescription: 'Desc',
        },
      };

      const response = await router.handle(request);
      expect(response.status).toBe(201);
      expect(response.body.target.channelId).toBe('ch-1');
    });

    it('returns 401 without session', async () => {
      const { campaignsModule, router } = setup();
      const { campaign } = campaignsModule.campaignService.createCampaign({
        title: 'Test',
        videoAssetId: 'v-1',
      });

      const request: ApiRequest = {
        method: 'POST',
        path: `/api/campaigns/${campaign.id}/targets`,
        session: null,
        body: {
          channelId: 'ch-1',
          videoTitle: 'Title',
          videoDescription: 'Desc',
        },
      };

      const response = await router.handle(request);
      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/campaigns/:id/ready in router', () => {
    it('marks campaign ready and returns 200', async () => {
      const { campaignsModule, router } = setup();
      const { campaign } = campaignsModule.campaignService.createCampaign({
        title: 'Test',
        videoAssetId: 'v-1',
      });
      campaignsModule.campaignService.addTarget(campaign.id, {
        channelId: 'ch-1',
        videoTitle: 'T',
        videoDescription: 'D',
      });

      const request: ApiRequest = {
        method: 'POST',
        path: `/api/campaigns/${campaign.id}/ready`,
        session: authedSession(),
      };

      const response = await router.handle(request);
      expect(response.status).toBe(200);
      expect(response.body.campaign.status).toBe('ready');
    });

    it('returns 400 for campaign with no targets', async () => {
      const { campaignsModule, router } = setup();
      const { campaign } = campaignsModule.campaignService.createCampaign({
        title: 'Test',
        videoAssetId: 'v-1',
      });

      const request: ApiRequest = {
        method: 'POST',
        path: `/api/campaigns/${campaign.id}/ready`,
        session: authedSession(),
      };

      const response = await router.handle(request);
      expect(response.status).toBe(400);
    });

    it('returns 401 without session', async () => {
      const { router } = setup();
      const request: ApiRequest = {
        method: 'POST',
        path: '/api/campaigns/any-id/ready',
        session: null,
      };

      const response = await router.handle(request);
      expect(response.status).toBe(401);
    });
  });

  describe('Duplicate PATCH removed from app.ts', () => {
    it('PATCH /api/campaigns/:id still works through router', async () => {
      const { campaignsModule, router } = setup();
      const { campaign } = campaignsModule.campaignService.createCampaign({
        title: 'Original',
        videoAssetId: 'v-1',
      });

      const request: ApiRequest = {
        method: 'PATCH',
        path: `/api/campaigns/${campaign.id}`,
        session: authedSession(),
        body: { title: 'Updated' },
      };

      const response = await router.handle(request);
      expect(response.status).toBe(200);
      expect(response.body.campaign.title).toBe('Updated');
    });
  });
});
