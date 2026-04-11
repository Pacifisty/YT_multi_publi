import { describe, expect, test, vi } from 'vitest';

import { CampaignsController } from '../../apps/api/src/campaigns/campaigns.controller';
import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';
import { PublishJobService, InMemoryPublishJobRepository } from '../../apps/api/src/campaigns/publish-job.service';
import { LaunchService } from '../../apps/api/src/campaigns/launch.service';
import { CampaignStatusService } from '../../apps/api/src/campaigns/campaign-status.service';
import { SessionGuard } from '../../apps/api/src/auth/session.guard';

function createAuthenticatedRequest(overrides: Partial<{ params: Record<string, string>; body: unknown }> = {}) {
  return {
    session: { adminUser: { email: 'admin@example.com' } },
    ...overrides,
  };
}

function createFullStack(now?: Date) {
  const campaignRepo = new InMemoryCampaignRepository();
  const campaignService = new CampaignService({ repository: campaignRepo, now: now ? () => now : undefined });
  const jobRepo = new InMemoryPublishJobRepository();
  const jobService = new PublishJobService({ repository: jobRepo, now: now ? () => now : undefined });
  const launchService = new LaunchService({ campaignService, jobService, now: now ? () => now : undefined });
  const statusService = new CampaignStatusService({ campaignService, jobService, now: now ? () => now : undefined });
  const controller = new CampaignsController(
    campaignService,
    new SessionGuard(),
    launchService,
    statusService,
  );

  return { campaignService, jobService, launchService, statusService, controller };
}

describe('controller launch wired to LaunchService', () => {
  test('POST /campaigns/:id/launch enqueues jobs for each target', async () => {
    const { controller, campaignService, jobService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({ title: 'Wired', videoAssetId: 'a1' });
    await campaignService.addTarget(campaign.id, { channelId: 'ch-1', videoTitle: 'V1', videoDescription: 'D1' });
    await campaignService.addTarget(campaign.id, { channelId: 'ch-2', videoTitle: 'V2', videoDescription: 'D2' });
    await campaignService.markReady(campaign.id);

    const response = await controller.launch(createAuthenticatedRequest({ params: { id: campaign.id } }));

    expect(response.status).toBe(200);
    expect(response.body.campaign!.status).toBe('launching');

    // Verify jobs were enqueued
    const t1Jobs = await jobService.getJobsForTarget(response.body.campaign!.targets[0].id);
    const t2Jobs = await jobService.getJobsForTarget(response.body.campaign!.targets[1].id);
    expect(t1Jobs).toHaveLength(1);
    expect(t2Jobs).toHaveLength(1);
  });
});

describe('controller status polling endpoint', () => {
  test('GET /campaigns/:id/status returns live status with shouldPoll', async () => {
    const { controller, campaignService, jobService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({ title: 'Polling', videoAssetId: 'a1' });
    const { target } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1', videoTitle: 'V1', videoDescription: 'D1',
    });
    await campaignService.markReady(campaign.id);
    await campaignService.launch(campaign.id);
    await jobService.enqueueForTargets([{ id: target.id, campaignId: campaign.id }]);

    const response = await controller.getStatus(createAuthenticatedRequest({ params: { id: campaign.id } }));

    expect(response.status).toBe(200);
    expect(response.body.campaignStatus).toBe('launching');
    expect(response.body.shouldPoll).toBe(true);
    expect(response.body.targets).toHaveLength(1);
    expect(response.body.progress).toMatchObject({ completed: 0, failed: 0, total: 1 });
  });

  test('GET /campaigns/:id/status includes explicit review metadata for partial post-upload failures', async () => {
    const { controller, campaignService, jobService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({ title: 'Partial Failure', videoAssetId: 'a1' });
    const { target } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1', videoTitle: 'V1', videoDescription: 'D1',
    });
    await campaignService.markReady(campaign.id);
    await campaignService.launch(campaign.id);
    const [job] = await jobService.enqueueForTargets([{ id: target.id, campaignId: campaign.id }]);
    await jobService.pickNext();
    await jobService.markFailed(
      job.id,
      'Video uploaded as yt-partial-123, but adding it to playlist failed: forbidden',
      'yt-partial-123',
    );
    await campaignService.updateTargetStatus(campaign.id, target.id, 'erro', {
      youtubeVideoId: 'yt-partial-123',
      errorMessage: 'Video uploaded as yt-partial-123, but adding it to playlist failed: forbidden',
    });

    const response = await controller.getStatus(createAuthenticatedRequest({ params: { id: campaign.id } }));

    expect(response.status).toBe(200);
    expect(response.body.targets[0]).toMatchObject({
      hasPostUploadWarning: true,
      reviewYoutubeUrl: 'https://www.youtube.com/watch?v=yt-partial-123',
    });
  });

  test('GET /campaigns/:id/status includes explicit scheduling metadata for future publishAt targets', async () => {
    const { controller, campaignService } = createFullStack(new Date('2026-04-10T16:00:00Z'));

    const { campaign } = await campaignService.createCampaign({ title: 'Scheduled Pending', videoAssetId: 'a1' });
    await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'Scheduled Target',
      videoDescription: 'Wait for publishAt',
      publishAt: '2026-04-10T18:00:00Z',
    });
    await campaignService.markReady(campaign.id);

    const launchResponse = await controller.launch(createAuthenticatedRequest({ params: { id: campaign.id } }));
    expect(launchResponse.status).toBe(200);

    const response = await controller.getStatus(createAuthenticatedRequest({ params: { id: campaign.id } }));

    expect(response.status).toBe(200);
    expect(response.body.shouldPoll).toBe(false);
    expect(response.body.nextScheduledAt).toBe('2026-04-10T18:00:00Z');
    expect(response.body.targets[0]).toMatchObject({
      publishAt: '2026-04-10T18:00:00Z',
      scheduledPending: true,
      latestJobStatus: null,
    });
  });

  test('GET /campaigns/:id/status includes explicit reauth metadata for auth failures', async () => {
    const { controller, campaignService, jobService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({ title: 'Reauth Needed', videoAssetId: 'a1' });
    const { target } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1', videoTitle: 'V1', videoDescription: 'D1',
    });
    await campaignService.markReady(campaign.id);
    await campaignService.launch(campaign.id);
    const [job] = await jobService.enqueueForTargets([{ id: target.id, campaignId: campaign.id }]);
    await jobService.pickNext();
    await jobService.markFailed(job.id, 'REAUTH_REQUIRED');
    await campaignService.updateTargetStatus(campaign.id, target.id, 'erro', {
      errorMessage: 'REAUTH_REQUIRED',
    });

    const response = await controller.getStatus(createAuthenticatedRequest({ params: { id: campaign.id } }));

    expect(response.status).toBe(200);
    expect(response.body.targets[0]).toMatchObject({
      errorMessage: 'REAUTH_REQUIRED',
      reauthRequired: true,
    });
  });

  test('GET /campaigns/:id/status returns 404 for missing campaign', async () => {
    const { controller } = createFullStack();

    const response = await controller.getStatus(createAuthenticatedRequest({ params: { id: 'nope' } }));
    expect(response.status).toBe(404);
  });
});

describe('controller target removal', () => {
  test('DELETE /campaigns/:id/targets/:targetId removes a target', async () => {
    const { controller, campaignService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({ title: 'Del', videoAssetId: 'a1' });
    const { target } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1', videoTitle: 'V1', videoDescription: 'D1',
    });

    const response = await controller.removeTarget(createAuthenticatedRequest({
      params: { id: campaign.id, targetId: target.id },
    }));

    expect(response.status).toBe(200);

    const fetched = await campaignService.getCampaign(campaign.id);
    expect(fetched!.campaign.targets).toHaveLength(0);
  });

  test('DELETE /campaigns/:id/targets/:targetId returns 404 for missing target', async () => {
    const { controller, campaignService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({ title: 'Del', videoAssetId: 'a1' });

    const response = await controller.removeTarget(createAuthenticatedRequest({
      params: { id: campaign.id, targetId: 'nonexistent' },
    }));

    expect(response.status).toBe(404);
  });
});

describe('controller campaign deletion', () => {
  test('DELETE /campaigns/:id removes a draft campaign', async () => {
    const { controller, campaignService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({ title: 'Gone', videoAssetId: 'a1' });

    const response = await controller.deleteCampaign(createAuthenticatedRequest({
      params: { id: campaign.id },
    }));

    expect(response.status).toBe(200);
    expect(await campaignService.getCampaign(campaign.id)).toBeNull();
  });

  test('DELETE /campaigns/:id rejects deleting a launching campaign', async () => {
    const { controller, campaignService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({ title: 'Active', videoAssetId: 'a1' });
    await campaignService.addTarget(campaign.id, { channelId: 'ch-1', videoTitle: 'V', videoDescription: 'D' });
    await campaignService.markReady(campaign.id);
    await campaignService.launch(campaign.id);

    const response = await controller.deleteCampaign(createAuthenticatedRequest({
      params: { id: campaign.id },
    }));

    expect(response.status).toBe(400);
  });
});

describe('controller campaign update', () => {
  test('PATCH /campaigns/:id updates title of a draft campaign', async () => {
    const { controller, campaignService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({ title: 'Old Title', videoAssetId: 'a1' });

    const response = await controller.update(createAuthenticatedRequest({
      params: { id: campaign.id },
      body: { title: 'New Title' },
    }));

    expect(response.status).toBe(200);
    expect(response.body.campaign!.title).toBe('New Title');
  });

  test('PATCH /campaigns/:id rejects update on a launching campaign', async () => {
    const { controller, campaignService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({ title: 'Locked', videoAssetId: 'a1' });
    await campaignService.addTarget(campaign.id, { channelId: 'ch-1', videoTitle: 'V', videoDescription: 'D' });
    await campaignService.markReady(campaign.id);
    await campaignService.launch(campaign.id);

    const response = await controller.update(createAuthenticatedRequest({
      params: { id: campaign.id },
      body: { title: 'Nope' },
    }));

    expect(response.status).toBe(400);
  });
});

describe('campaign scheduling', () => {
  test('creates a campaign with a scheduledAt date', async () => {
    const { controller, campaignService } = createFullStack();

    const response = await controller.create(createAuthenticatedRequest({
      body: {
        title: 'Scheduled Launch',
        videoAssetId: 'a1',
        scheduledAt: '2026-04-10T15:00:00Z',
      },
    }));

    expect(response.status).toBe(201);
    expect(response.body.campaign!.scheduledAt).toBe('2026-04-10T15:00:00Z');
  });

  test('scheduled campaign can be launched early via manual launch', async () => {
    const { controller, campaignService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({
      title: 'Scheduled',
      videoAssetId: 'a1',
      scheduledAt: '2026-04-10T15:00:00Z',
    });
    await campaignService.addTarget(campaign.id, { channelId: 'ch-1', videoTitle: 'V', videoDescription: 'D' });
    await campaignService.markReady(campaign.id);

    const response = await controller.launch(createAuthenticatedRequest({
      params: { id: campaign.id },
    }));

    expect(response.status).toBe(200);
    expect(response.body.campaign!.status).toBe('launching');
  });

  test('campaign list shows scheduledAt for scheduled campaigns', async () => {
    const { campaignService } = createFullStack();

    await campaignService.createCampaign({
      title: 'Scheduled One',
      videoAssetId: 'a1',
      scheduledAt: '2026-04-10T15:00:00Z',
    });

    const { campaigns } = await campaignService.listCampaigns();
    expect(campaigns[0].scheduledAt).toBe('2026-04-10T15:00:00Z');
  });

  test('campaign without scheduledAt has null scheduledAt', async () => {
    const { campaignService } = createFullStack();

    await campaignService.createCampaign({ title: 'Immediate', videoAssetId: 'a1' });

    const { campaigns } = await campaignService.listCampaigns();
    expect(campaigns[0].scheduledAt).toBeNull();
  });
});
