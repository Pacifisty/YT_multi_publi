import { describe, it, expect } from 'vitest';
import { createApiRouter } from '../../apps/api/src/router';
import { createCampaignsModule } from '../../apps/api/src/campaigns/campaigns.module';
import type { ApiRequest } from '../../apps/api/src/router';

function setup() {
  const campaignsModule = createCampaignsModule();
  const { campaignService, auditService } = campaignsModule;
  const router = createApiRouter({ campaignsModule });
  const session = { adminUser: { id: 'admin-1', email: 'a@b.com' } };
  return { campaignService, auditService, router, session };
}

async function createCampaignWithTarget(campaignService: CampaignService) {
  const { campaign } = await campaignService.createCampaign({
    title: 'Test Campaign',
    videoAssetId: 'asset-1',
  });
  const { target } = await campaignService.addTarget(campaign.id, {
    channelId: 'ch-1',
    videoTitle: 'Video Title',
    videoDescription: 'Description',
  });
  return { campaign, target };
}

describe('Campaign Target Management Routes', () => {
  describe('POST /api/campaigns/:id/targets/bulk', () => {
    it('creates multiple targets in a single request', async () => {
      const { campaignService, auditService, router, session } = setup();
      const { campaign } = await campaignService.createCampaign({
        title: 'Test Campaign',
        videoAssetId: 'asset-1',
      });

      const request: ApiRequest = {
        method: 'POST',
        path: `/api/campaigns/${campaign.id}/targets/bulk`,
        session,
        body: {
          targets: [
            {
              channelId: 'ch-1',
              videoTitle: 'Title 1',
              videoDescription: 'Description 1',
              publishAt: '2026-05-01T15:00:00.000Z',
            },
            {
              channelId: 'ch-2',
              videoTitle: 'Title 2',
              videoDescription: 'Description 2',
            },
          ],
        },
      };

      const response = await router.handle(request);
      expect(response.status).toBe(201);
      expect(response.body.targets).toHaveLength(2);
      expect(response.body.targets[0]).toMatchObject({
        channelId: 'ch-1',
        videoTitle: 'Title 1',
        publishAt: '2026-05-01T15:00:00.000Z',
      });
      expect(response.body.targets[1]).toMatchObject({
        channelId: 'ch-2',
        videoTitle: 'Title 2',
        publishAt: null,
      });
      await expect(auditService.listEvents()).resolves.toEqual([
        expect.objectContaining({
          eventType: 'add_targets_bulk',
          actorEmail: 'a@b.com',
          campaignId: campaign.id,
          targetId: null,
        }),
      ]);
    });

    it('rejects duplicate channelIds in one batch without creating partial targets', async () => {
      const { campaignService, router, session } = setup();
      const { campaign } = await campaignService.createCampaign({
        title: 'Test Campaign',
        videoAssetId: 'asset-1',
      });

      const response = await router.handle({
        method: 'POST',
        path: `/api/campaigns/${campaign.id}/targets/bulk`,
        session,
        body: {
          targets: [
            {
              channelId: 'ch-1',
              videoTitle: 'Title 1',
              videoDescription: 'Description 1',
            },
            {
              channelId: 'ch-1',
              videoTitle: 'Title 2',
              videoDescription: 'Description 2',
            },
          ],
        },
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Duplicate channelId');

      const result = await campaignService.getCampaign(campaign.id);
      expect(result!.campaign.targets).toHaveLength(0);
    });

    it('rejects a batch when one channel already exists in the campaign without creating partial targets', async () => {
      const { campaignService, router, session } = setup();
      const { campaign } = await campaignService.createCampaign({
        title: 'Test Campaign',
        videoAssetId: 'asset-1',
      });

      await campaignService.addTarget(campaign.id, {
        channelId: 'ch-existing',
        videoTitle: 'Existing Title',
        videoDescription: 'Existing Description',
      });

      const response = await router.handle({
        method: 'POST',
        path: `/api/campaigns/${campaign.id}/targets/bulk`,
        session,
        body: {
          targets: [
            {
              channelId: 'ch-new',
              videoTitle: 'New Title',
              videoDescription: 'New Description',
            },
            {
              channelId: 'ch-existing',
              videoTitle: 'Duplicate Title',
              videoDescription: 'Duplicate Description',
            },
          ],
        },
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists in campaign');

      const result = await campaignService.getCampaign(campaign.id);
      expect(result!.campaign.targets).toHaveLength(1);
      expect(result!.campaign.targets[0].channelId).toBe('ch-existing');
    });
  });

  describe('POST /api/campaigns/:id/targets', () => {
    it('creates a target with publishAt scheduling metadata', async () => {
      const { campaignService, auditService, router, session } = setup();
      const { campaign } = await campaignService.createCampaign({
        title: 'Test Campaign',
        videoAssetId: 'asset-1',
      });

      const request: ApiRequest = {
        method: 'POST',
        path: `/api/campaigns/${campaign.id}/targets`,
        session,
        body: {
          channelId: 'ch-1',
          videoTitle: 'Scheduled Title',
          videoDescription: 'Scheduled Description',
          publishAt: '2026-05-01T15:00:00.000Z',
        },
      };

      const response = await router.handle(request);
      expect(response.status).toBe(201);
      expect(response.body.target.publishAt).toBe('2026-05-01T15:00:00.000Z');
      await expect(auditService.listEvents()).resolves.toEqual([
        expect.objectContaining({
          eventType: 'add_target',
          actorEmail: 'a@b.com',
          campaignId: campaign.id,
          targetId: response.body.target.id,
        }),
      ]);
    });

    it('rejects adding the same channel twice to one campaign', async () => {
      const { campaignService, router, session } = setup();
      const { campaign } = await campaignService.createCampaign({
        title: 'Test Campaign',
        videoAssetId: 'asset-1',
      });

      await campaignService.addTarget(campaign.id, {
        channelId: 'ch-1',
        videoTitle: 'First Title',
        videoDescription: 'First Description',
      });

      const response = await router.handle({
        method: 'POST',
        path: `/api/campaigns/${campaign.id}/targets`,
        session,
        body: {
          channelId: 'ch-1',
          videoTitle: 'Duplicate Title',
          videoDescription: 'Duplicate Description',
        },
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already exists in the campaign');
    });
  });

  describe('DELETE /api/campaigns/:id/targets/:targetId', () => {
    it('removes a target and returns 200', async () => {
      const { campaignService, auditService, router, session } = setup();
      const { campaign, target } = await createCampaignWithTarget(campaignService);

      const request: ApiRequest = {
        method: 'DELETE',
        path: `/api/campaigns/${campaign.id}/targets/${target.id}`,
        session,
      };

      const response = await router.handle(request);
      expect(response.status).toBe(200);

      // Verify target is actually removed
      const result = await campaignService.getCampaign(campaign.id);
      expect(result!.campaign.targets).toHaveLength(0);
      await expect(auditService.listEvents()).resolves.toEqual([
        expect.objectContaining({
          eventType: 'remove_target',
          actorEmail: 'a@b.com',
          campaignId: campaign.id,
          targetId: target.id,
        }),
      ]);
    });

    it('returns 404 for non-existent target', async () => {
      const { campaignService, router, session } = setup();
      const { campaign } = await createCampaignWithTarget(campaignService);

      const request: ApiRequest = {
        method: 'DELETE',
        path: `/api/campaigns/${campaign.id}/targets/non-existent`,
        session,
      };

      const response = await router.handle(request);
      expect(response.status).toBe(404);
    });

    it('returns 401 without session', async () => {
      const { campaignService, router } = setup();
      const { campaign, target } = await createCampaignWithTarget(campaignService);

      const request: ApiRequest = {
        method: 'DELETE',
        path: `/api/campaigns/${campaign.id}/targets/${target.id}`,
        session: null,
      };

      const response = await router.handle(request);
      expect(response.status).toBe(401);
    });
  });

  describe('PATCH /api/campaigns/:id/targets/:targetId', () => {
    it('updates videoTitle and returns updated target', async () => {
      const { campaignService, auditService, router, session } = setup();
      const { campaign, target } = await createCampaignWithTarget(campaignService);

      const request: ApiRequest = {
        method: 'PATCH',
        path: `/api/campaigns/${campaign.id}/targets/${target.id}`,
        session,
        body: { videoTitle: 'Updated Title' },
      };

      const response = await router.handle(request);
      expect(response.status).toBe(200);
      expect(response.body.target.videoTitle).toBe('Updated Title');
      expect(response.body.target.videoDescription).toBe('Description');
      await expect(auditService.listEvents()).resolves.toEqual([
        expect.objectContaining({
          eventType: 'update_target',
          actorEmail: 'a@b.com',
          campaignId: campaign.id,
          targetId: target.id,
        }),
      ]);
    });

    it('updates videoDescription', async () => {
      const { campaignService, router, session } = setup();
      const { campaign, target } = await createCampaignWithTarget(campaignService);

      const request: ApiRequest = {
        method: 'PATCH',
        path: `/api/campaigns/${campaign.id}/targets/${target.id}`,
        session,
        body: { videoDescription: 'New Desc' },
      };

      const response = await router.handle(request);
      expect(response.status).toBe(200);
      expect(response.body.target.videoDescription).toBe('New Desc');
    });

    it('updates tags and privacy', async () => {
      const { campaignService, router, session } = setup();
      const { campaign, target } = await createCampaignWithTarget(campaignService);

      const request: ApiRequest = {
        method: 'PATCH',
        path: `/api/campaigns/${campaign.id}/targets/${target.id}`,
        session,
        body: { tags: ['tag1', 'tag2'], privacy: 'public' },
      };

      const response = await router.handle(request);
      expect(response.status).toBe(200);
      expect(response.body.target.tags).toEqual(['tag1', 'tag2']);
      expect(response.body.target.privacy).toBe('public');
    });

    it('updates thumbnailAssetId', async () => {
      const { campaignService, router, session } = setup();
      const { campaign, target } = await createCampaignWithTarget(campaignService);

      const request: ApiRequest = {
        method: 'PATCH',
        path: `/api/campaigns/${campaign.id}/targets/${target.id}`,
        session,
        body: { thumbnailAssetId: 'thumb-99' },
      };

      const response = await router.handle(request);
      expect(response.status).toBe(200);
      expect(response.body.target.thumbnailAssetId).toBe('thumb-99');
    });

    it('updates publishAt', async () => {
      const { campaignService, router, session } = setup();
      const { campaign, target } = await createCampaignWithTarget(campaignService);

      const request: ApiRequest = {
        method: 'PATCH',
        path: `/api/campaigns/${campaign.id}/targets/${target.id}`,
        session,
        body: { publishAt: '2026-05-01T15:00:00.000Z' },
      };

      const response = await router.handle(request);
      expect(response.status).toBe(200);
      expect(response.body.target.publishAt).toBe('2026-05-01T15:00:00.000Z');
    });

    it('returns 404 for non-existent target', async () => {
      const { campaignService, router, session } = setup();
      const { campaign } = await createCampaignWithTarget(campaignService);

      const request: ApiRequest = {
        method: 'PATCH',
        path: `/api/campaigns/${campaign.id}/targets/bogus`,
        session,
        body: { videoTitle: 'X' },
      };

      const response = await router.handle(request);
      expect(response.status).toBe(404);
    });

    it('returns 401 without session', async () => {
      const { campaignService, router } = setup();
      const { campaign, target } = await createCampaignWithTarget(campaignService);

      const request: ApiRequest = {
        method: 'PATCH',
        path: `/api/campaigns/${campaign.id}/targets/${target.id}`,
        session: null,
        body: { videoTitle: 'X' },
      };

      const response = await router.handle(request);
      expect(response.status).toBe(401);
    });

    it('returns 400 when body is empty', async () => {
      const { campaignService, router, session } = setup();
      const { campaign, target } = await createCampaignWithTarget(campaignService);

      const request: ApiRequest = {
        method: 'PATCH',
        path: `/api/campaigns/${campaign.id}/targets/${target.id}`,
        session,
        body: {},
      };

      const response = await router.handle(request);
      expect(response.status).toBe(400);
      expect(response.body.error).toContain('No updatable fields');
    });
  });
});
