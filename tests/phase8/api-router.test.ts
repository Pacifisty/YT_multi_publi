import { describe, expect, test } from 'vitest';

import {
  createApiRouter,
  type ApiRequest,
  type ApiResponse,
} from '../../apps/api/src/router';

import { createCampaignsModule } from '../../apps/api/src/campaigns/campaigns.module';

function authenticatedRequest(overrides: Partial<ApiRequest> = {}): ApiRequest {
  return {
    method: 'GET',
    path: '/',
    session: { adminUser: { email: 'admin@test.com' } },
    body: undefined,
    ...overrides,
  };
}

function unauthenticatedRequest(overrides: Partial<ApiRequest> = {}): ApiRequest {
  return {
    method: 'GET',
    path: '/',
    session: null,
    body: undefined,
    ...overrides,
  };
}

describe('API router dispatches campaign routes', () => {
  test('POST /api/campaigns creates a campaign', async () => {
    const mod = createCampaignsModule();
    const router = createApiRouter({ campaignsModule: mod });

    const res = await router.handle(authenticatedRequest({
      method: 'POST',
      path: '/api/campaigns',
      body: { title: 'My Campaign', videoAssetId: 'v1' },
    }));

    expect(res.status).toBe(201);
    expect(res.body.campaign.title).toBe('My Campaign');
  });

  test('GET /api/campaigns lists campaigns', async () => {
    const mod = createCampaignsModule();
    mod.campaignService.createCampaign({ title: 'C1', videoAssetId: 'v1' });

    const router = createApiRouter({ campaignsModule: mod });
    const res = await router.handle(authenticatedRequest({
      method: 'GET',
      path: '/api/campaigns',
    }));

    expect(res.status).toBe(200);
    expect(res.body.campaigns).toHaveLength(1);
  });

  test('GET /api/campaigns/:id returns a campaign', async () => {
    const mod = createCampaignsModule();
    const { campaign } = mod.campaignService.createCampaign({ title: 'C1', videoAssetId: 'v1' });

    const router = createApiRouter({ campaignsModule: mod });
    const res = await router.handle(authenticatedRequest({
      method: 'GET',
      path: `/api/campaigns/${campaign.id}`,
    }));

    expect(res.status).toBe(200);
    expect(res.body.campaign.title).toBe('C1');
  });

  test('DELETE /api/campaigns/:id deletes a campaign', async () => {
    const mod = createCampaignsModule();
    const { campaign } = mod.campaignService.createCampaign({ title: 'C1', videoAssetId: 'v1' });

    const router = createApiRouter({ campaignsModule: mod });
    const res = await router.handle(authenticatedRequest({
      method: 'DELETE',
      path: `/api/campaigns/${campaign.id}`,
    }));

    expect(res.status).toBe(200);
    // Confirm it's actually gone
    const listRes = await router.handle(authenticatedRequest({
      method: 'GET',
      path: '/api/campaigns',
    }));
    expect(listRes.body.campaigns).toHaveLength(0);
  });

  test('POST /api/campaigns/:id/launch launches a ready campaign', async () => {
    const mod = createCampaignsModule();
    const { campaign } = mod.campaignService.createCampaign({ title: 'C1', videoAssetId: 'v1' });
    mod.campaignService.addTarget(campaign.id, {
      channelId: 'ch1', videoTitle: 'V', videoDescription: 'D',
    });
    mod.campaignService.markReady(campaign.id);

    const router = createApiRouter({ campaignsModule: mod });
    const res = await router.handle(authenticatedRequest({
      method: 'POST',
      path: `/api/campaigns/${campaign.id}/launch`,
    }));

    expect(res.status).toBe(200);
    expect(res.body.campaign.status).toBe('launching');
  });

  test('GET /api/campaigns/:id/status returns campaign status', async () => {
    const mod = createCampaignsModule();
    const { campaign } = mod.campaignService.createCampaign({ title: 'C1', videoAssetId: 'v1' });
    mod.campaignService.addTarget(campaign.id, {
      channelId: 'ch1', videoTitle: 'V', videoDescription: 'D',
    });
    mod.campaignService.markReady(campaign.id);
    mod.launchService.launchCampaign(campaign.id);

    const router = createApiRouter({ campaignsModule: mod });
    const res = await router.handle(authenticatedRequest({
      method: 'GET',
      path: `/api/campaigns/${campaign.id}/status`,
    }));

    expect(res.status).toBe(200);
    expect(res.body.campaignStatus).toBe('launching');
    expect(res.body.shouldPoll).toBe(true);
  });

  test('GET /api/dashboard returns dashboard stats', async () => {
    const mod = createCampaignsModule();
    mod.campaignService.createCampaign({ title: 'C1', videoAssetId: 'v1' });

    const router = createApiRouter({ campaignsModule: mod });
    const res = await router.handle(authenticatedRequest({
      method: 'GET',
      path: '/api/dashboard',
    }));

    expect(res.status).toBe(200);
    expect(res.body.campaigns.total).toBe(1);
  });

  test('POST /api/campaigns/:id/targets/:targetId/retry retries a failed target', async () => {
    const mod = createCampaignsModule();
    const { campaign } = mod.campaignService.createCampaign({ title: 'C1', videoAssetId: 'v1' });
    const { target } = mod.campaignService.addTarget(campaign.id, {
      channelId: 'ch1', videoTitle: 'V', videoDescription: 'D',
    });
    mod.campaignService.markReady(campaign.id);
    mod.launchService.launchCampaign(campaign.id);
    // Fail the job
    const jobs = mod.jobService.getJobsForTarget(target.id);
    mod.jobService.pick(jobs[0].id);
    mod.jobService.fail(jobs[0].id, 'quotaExceeded');

    const router = createApiRouter({ campaignsModule: mod });
    const res = await router.handle(authenticatedRequest({
      method: 'POST',
      path: `/api/campaigns/${campaign.id}/targets/${target.id}/retry`,
    }));

    expect(res.status).toBe(200);
    expect(res.body.job.status).toBe('queued');
  });
});

describe('API router rejects unauthenticated requests', () => {
  test('returns 401 for unauthenticated campaign list', async () => {
    const mod = createCampaignsModule();
    const router = createApiRouter({ campaignsModule: mod });

    const res = await router.handle(unauthenticatedRequest({
      method: 'GET',
      path: '/api/campaigns',
    }));

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });
});

describe('API router handles unknown routes', () => {
  test('returns 404 for unknown path', async () => {
    const mod = createCampaignsModule();
    const router = createApiRouter({ campaignsModule: mod });

    const res = await router.handle(authenticatedRequest({
      method: 'GET',
      path: '/api/unknown',
    }));

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });
});
