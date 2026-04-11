import { describe, it, expect } from 'vitest';
import { createApiRouter } from '../../apps/api/src/router';
import { createCampaignsModule } from '../../apps/api/src/campaigns/campaigns.module';
import type { ApiRequest } from '../../apps/api/src/router';

const authedSession = () => ({ adminUser: { email: 'admin@test.com' } });

function setup() {
  const campaignsModule = createCampaignsModule();
  const { campaignService } = campaignsModule;
  const router = createApiRouter({ campaignsModule });
  return { campaignService, router, campaignsModule };
}

async function seedWithTargets(campaignService: ReturnType<typeof setup>['campaignService']) {
  const { campaign } = await campaignService.createCampaign({
    title: 'Original Campaign',
    videoAssetId: 'v-orig',
    scheduledAt: '2026-06-01T10:00:00Z',
  });
  await campaignService.addTarget(campaign.id, {
    channelId: 'ch-1',
    videoTitle: 'Video for Channel 1',
    videoDescription: 'Desc 1',
    tags: ['tag1', 'tag2'],
    privacy: 'public',
    thumbnailAssetId: 'thumb-1',
  });
  await campaignService.addTarget(campaign.id, {
    channelId: 'ch-2',
    videoTitle: 'Video for Channel 2',
    videoDescription: 'Desc 2',
  });
  return (await campaignService.getCampaign(campaign.id))!.campaign;
}

describe('Campaign Clone', () => {
  describe('POST /api/campaigns/:id/clone', () => {
    it('clones a campaign as a new draft', async () => {
      const { campaignService, router } = setup();
      const original = await seedWithTargets(campaignService);

      const request: ApiRequest = {
        method: 'POST',
        path: `/api/campaigns/${original.id}/clone`,
        session: authedSession(),
      };

      const response = await router.handle(request);
      expect(response.status).toBe(201);
      expect(response.body.campaign).toBeDefined();
      expect(response.body.campaign.id).not.toBe(original.id);
      expect(response.body.campaign.status).toBe('draft');
    });

    it('copies title with "Copy of" prefix', async () => {
      const { campaignService, router } = setup();
      const original = await seedWithTargets(campaignService);

      const request: ApiRequest = {
        method: 'POST',
        path: `/api/campaigns/${original.id}/clone`,
        session: authedSession(),
      };

      const response = await router.handle(request);
      expect(response.body.campaign.title).toBe('Copy of Original Campaign');
    });

    it('copies videoAssetId and scheduledAt', async () => {
      const { campaignService, router } = setup();
      const original = await seedWithTargets(campaignService);

      const request: ApiRequest = {
        method: 'POST',
        path: `/api/campaigns/${original.id}/clone`,
        session: authedSession(),
      };

      const response = await router.handle(request);
      expect(response.body.campaign.videoAssetId).toBe(original.videoAssetId);
      expect(response.body.campaign.scheduledAt).toBe(original.scheduledAt);
    });

    it('clones all targets with new IDs', async () => {
      const { campaignService, router } = setup();
      const original = await seedWithTargets(campaignService);

      const request: ApiRequest = {
        method: 'POST',
        path: `/api/campaigns/${original.id}/clone`,
        session: authedSession(),
      };

      const response = await router.handle(request);
      const cloned = response.body.campaign;
      expect(cloned.targets).toHaveLength(2);

      // New IDs for each target
      const originalTargetIds = original.targets.map((t: any) => t.id);
      cloned.targets.forEach((t: any) => {
        expect(originalTargetIds).not.toContain(t.id);
      });
    });

    it('copies target details (channel, title, description, tags, privacy, thumbnail)', async () => {
      const { campaignService, router } = setup();
      const original = await seedWithTargets(campaignService);

      const request: ApiRequest = {
        method: 'POST',
        path: `/api/campaigns/${original.id}/clone`,
        session: authedSession(),
      };

      const response = await router.handle(request);
      const targets = response.body.campaign.targets;

      const t1 = targets.find((t: any) => t.channelId === 'ch-1');
      expect(t1.videoTitle).toBe('Video for Channel 1');
      expect(t1.videoDescription).toBe('Desc 1');
      expect(t1.tags).toEqual(['tag1', 'tag2']);
      expect(t1.privacy).toBe('public');
      expect(t1.thumbnailAssetId).toBe('thumb-1');

      const t2 = targets.find((t: any) => t.channelId === 'ch-2');
      expect(t2.videoTitle).toBe('Video for Channel 2');
      expect(t2.privacy).toBe('private');
    });

    it('resets target status to aguardando', async () => {
      const { campaignService, router } = setup();
      const original = await seedWithTargets(campaignService);
      // Make the original ready (changes target statuses potentially)
      await campaignService.markReady(original.id);

      const request: ApiRequest = {
        method: 'POST',
        path: `/api/campaigns/${original.id}/clone`,
        session: authedSession(),
      };

      const response = await router.handle(request);
      response.body.campaign.targets.forEach((t: any) => {
        expect(t.status).toBe('aguardando');
        expect(t.youtubeVideoId).toBeNull();
        expect(t.errorMessage).toBeNull();
        expect(t.retryCount).toBe(0);
      });
    });

    it('returns 404 for nonexistent campaign', async () => {
      const { router } = setup();

      const request: ApiRequest = {
        method: 'POST',
        path: '/api/campaigns/nonexistent/clone',
        session: authedSession(),
      };

      const response = await router.handle(request);
      expect(response.status).toBe(404);
    });

    it('returns 401 without session', async () => {
      const { campaignService, router } = setup();
      const original = await seedWithTargets(campaignService);

      const request: ApiRequest = {
        method: 'POST',
        path: `/api/campaigns/${original.id}/clone`,
        session: null,
      };

      const response = await router.handle(request);
      expect(response.status).toBe(401);
    });

    it('allows custom title override in body', async () => {
      const { campaignService, router } = setup();
      const original = await seedWithTargets(campaignService);

      const request: ApiRequest = {
        method: 'POST',
        path: `/api/campaigns/${original.id}/clone`,
        session: authedSession(),
        body: { title: 'My Custom Clone' },
      };

      const response = await router.handle(request);
      expect(response.body.campaign.title).toBe('My Custom Clone');
    });

    it('records an audit event when a campaign is cloned', async () => {
      const { campaignService, router, campaignsModule } = setup();
      const original = await seedWithTargets(campaignService);

      const request: ApiRequest = {
        method: 'POST',
        path: `/api/campaigns/${original.id}/clone`,
        session: authedSession(),
      };

      const response = await router.handle(request);
      expect(response.status).toBe(201);
      const auditEvents = await campaignsModule.auditService.listEvents();
      expect(auditEvents).toHaveLength(1);
      expect(auditEvents[0]).toMatchObject({
        eventType: 'clone_campaign',
        actorEmail: 'admin@test.com',
        campaignId: original.id,
        targetId: null,
      });
    });
  });
});
