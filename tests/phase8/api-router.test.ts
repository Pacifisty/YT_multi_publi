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
    await mod.campaignService.createCampaign({ title: 'C1', videoAssetId: 'v1' });

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
    const { campaign } = await mod.campaignService.createCampaign({ title: 'C1', videoAssetId: 'v1' });

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
    const { campaign } = await mod.campaignService.createCampaign({ title: 'C1', videoAssetId: 'v1' });

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
    await expect(mod.auditService.listEvents()).resolves.toEqual([
      expect.objectContaining({
        eventType: 'delete_campaign',
        actorEmail: 'admin@test.com',
        campaignId: campaign.id,
        targetId: null,
      }),
    ]);
  });

  test('POST /api/campaigns/:id/launch launches a ready campaign', async () => {
    const mod = createCampaignsModule();
    const { campaign } = await mod.campaignService.createCampaign({ title: 'C1', videoAssetId: 'v1' });
    await mod.campaignService.addTarget(campaign.id, {
      channelId: 'ch1', videoTitle: 'V', videoDescription: 'D',
    });
    await mod.campaignService.markReady(campaign.id);

    const router = createApiRouter({ campaignsModule: mod });
    const res = await router.handle(authenticatedRequest({
      method: 'POST',
      path: `/api/campaigns/${campaign.id}/launch`,
    }));

    expect(res.status).toBe(200);
    expect(res.body.campaign.status).toBe('launching');
  });

  test('POST /api/campaigns/:id/targets/bulk creates multiple targets', async () => {
    const mod = createCampaignsModule();
    const { campaign } = await mod.campaignService.createCampaign({ title: 'C1', videoAssetId: 'v1' });

    const router = createApiRouter({ campaignsModule: mod });
    const res = await router.handle(authenticatedRequest({
      method: 'POST',
      path: `/api/campaigns/${campaign.id}/targets/bulk`,
      body: {
        targets: [
          {
            channelId: 'ch1',
            videoTitle: 'V1',
            videoDescription: 'D1',
          },
          {
            channelId: 'ch2',
            videoTitle: 'V2',
            videoDescription: 'D2',
          },
        ],
      },
    }));

    expect(res.status).toBe(201);
    expect(res.body.targets).toHaveLength(2);
    expect(res.body.targets[0].channelId).toBe('ch1');
    expect(res.body.targets[1].channelId).toBe('ch2');
  });

  test('GET /api/campaigns/:id/status returns campaign status', async () => {
    const mod = createCampaignsModule();
    const { campaign } = await mod.campaignService.createCampaign({ title: 'C1', videoAssetId: 'v1' });
    await mod.campaignService.addTarget(campaign.id, {
      channelId: 'ch1', videoTitle: 'V', videoDescription: 'D',
    });
    await mod.campaignService.markReady(campaign.id);
    await mod.launchService.launchCampaign(campaign.id);

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
    await mod.campaignService.createCampaign({ title: 'C1', videoAssetId: 'v1' });

    const router = createApiRouter({ campaignsModule: mod });
    const res = await router.handle(authenticatedRequest({
      method: 'GET',
      path: '/api/dashboard',
    }));

    expect(res.status).toBe(200);
    expect(res.body.campaigns.total).toBe(1);
    expect(res.body.quota.dailyLimitUnits).toBe(10000);
  });

  test('POST /api/campaigns/:id/targets/:targetId/retry retries a failed target', async () => {
    const mod = createCampaignsModule();
    const { campaign } = await mod.campaignService.createCampaign({ title: 'C1', videoAssetId: 'v1' });
    const { target } = await mod.campaignService.addTarget(campaign.id, {
      channelId: 'ch1', videoTitle: 'V', videoDescription: 'D',
    });
    await mod.campaignService.markReady(campaign.id);
    await mod.launchService.launchCampaign(campaign.id);
    // Fail the job
    const jobs = await mod.jobService.getJobsForTarget(target.id);
    await mod.jobService.pickNext(); // transitions to processing
    await mod.jobService.markFailed(jobs[0].id, 'quotaExceeded');

    const router = createApiRouter({ campaignsModule: mod });
    const res = await router.handle(authenticatedRequest({
      method: 'POST',
      path: `/api/campaigns/${campaign.id}/targets/${target.id}/retry`,
    }));

    expect(res.status).toBe(200);
    expect(res.body.job.status).toBe('queued');
  });

  test('GET /api/campaigns/:id/targets/:targetId/jobs returns target job history', async () => {
    const mod = createCampaignsModule();
    const { campaign } = await mod.campaignService.createCampaign({ title: 'C1', videoAssetId: 'v1' });
    const { target } = await mod.campaignService.addTarget(campaign.id, {
      channelId: 'ch1', videoTitle: 'V', videoDescription: 'D',
    });
    await mod.campaignService.markReady(campaign.id);
    await mod.launchService.launchCampaign(campaign.id);
    const jobs = await mod.jobService.getJobsForTarget(target.id);
    await mod.jobService.pickNext();
    await mod.jobService.markFailed(jobs[0].id, 'quotaExceeded');

    const router = createApiRouter({ campaignsModule: mod });
    const res = await router.handle(authenticatedRequest({
      method: 'GET',
      path: `/api/campaigns/${campaign.id}/targets/${target.id}/jobs`,
    }));

    expect(res.status).toBe(200);
    expect(res.body.jobs).toHaveLength(1);
    expect(res.body.jobs[0]).toMatchObject({
      id: jobs[0].id,
      campaignTargetId: target.id,
      status: 'failed',
    });
  });

  test('GET /api/campaigns/:id/jobs returns campaign job history grouped by target', async () => {
    const mod = createCampaignsModule();
    const { campaign } = await mod.campaignService.createCampaign({ title: 'C1', videoAssetId: 'v1' });
    const { target: t1 } = await mod.campaignService.addTarget(campaign.id, {
      channelId: 'ch1', videoTitle: 'V1', videoDescription: 'D1',
    });
    const { target: t2 } = await mod.campaignService.addTarget(campaign.id, {
      channelId: 'ch2', videoTitle: 'V2', videoDescription: 'D2',
    });
    await mod.campaignService.markReady(campaign.id);
    await mod.launchService.launchCampaign(campaign.id);
    const jobs = await mod.jobService.getAllJobs();
    await mod.jobService.pickNext();
    await mod.jobService.markFailed(jobs[0].id, 'quotaExceeded');

    const router = createApiRouter({ campaignsModule: mod });
    const res = await router.handle(authenticatedRequest({
      method: 'GET',
      path: `/api/campaigns/${campaign.id}/jobs`,
    }));

    expect(res.status).toBe(200);
    expect(res.body.jobsByTarget[t1.id]).toHaveLength(1);
    expect(res.body.jobsByTarget[t2.id]).toHaveLength(1);
  });

  test('GET /api/campaigns/:id/audit returns audit history filtered to the campaign', async () => {
    const mod = createCampaignsModule();
    const { campaign: c1 } = await mod.campaignService.createCampaign({ title: 'C1', videoAssetId: 'v1' });
    const { campaign: c2 } = await mod.campaignService.createCampaign({ title: 'C2', videoAssetId: 'v2' });

    await mod.auditService.record({
      eventType: 'launch_campaign',
      actorEmail: 'ops@test.com',
      campaignId: c1.id,
    });
    await mod.auditService.record({
      eventType: 'update_campaign',
      actorEmail: 'ops@test.com',
      campaignId: c2.id,
    });
    await mod.auditService.record({
      eventType: 'publish_partial_failure',
      actorEmail: 'system@internal',
      campaignId: c1.id,
      targetId: 't1',
    });

    const router = createApiRouter({ campaignsModule: mod });
    const res = await router.handle(authenticatedRequest({
      method: 'GET',
      path: `/api/campaigns/${c1.id}/audit`,
    }));

    expect(res.status).toBe(200);
    expect(res.body.events).toHaveLength(2);
    expect(res.body.events[0]).toMatchObject({
      eventType: 'publish_partial_failure',
      campaignId: c1.id,
      targetId: 't1',
    });
    expect(res.body.events[1]).toMatchObject({
      eventType: 'launch_campaign',
      campaignId: c1.id,
      targetId: null,
    });
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
