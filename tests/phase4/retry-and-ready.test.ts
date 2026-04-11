import { describe, expect, test } from 'vitest';

import { CampaignsController } from '../../apps/api/src/campaigns/campaigns.controller';
import { AuditEventService, InMemoryAuditEventRepository } from '../../apps/api/src/campaigns/audit-event.service';
import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';
import { PublishJobService, InMemoryPublishJobRepository } from '../../apps/api/src/campaigns/publish-job.service';
import { LaunchService } from '../../apps/api/src/campaigns/launch.service';
import { CampaignStatusService } from '../../apps/api/src/campaigns/campaign-status.service';
import { SessionGuard } from '../../apps/api/src/auth/session.guard';

function createFullStack() {
  const campaignRepo = new InMemoryCampaignRepository();
  const campaignService = new CampaignService({ repository: campaignRepo });
  const jobRepo = new InMemoryPublishJobRepository();
  const jobService = new PublishJobService({ repository: jobRepo, maxAttempts: 3 });
  const auditRepo = new InMemoryAuditEventRepository();
  const auditService = new AuditEventService({ repository: auditRepo });
  const launchService = new LaunchService({ campaignService, jobService });
  const statusService = new CampaignStatusService({ campaignService, jobService });
  const controller = new CampaignsController(
    campaignService,
    new SessionGuard(),
    launchService,
    statusService,
    jobService,
    undefined,
    auditService,
  );

  return { campaignService, jobService, launchService, statusService, auditService, controller };
}

function authRequest(overrides: Partial<{ params: Record<string, string>; body: unknown }> = {}) {
  return {
    session: { adminUser: { email: 'admin@example.com' } },
    ...overrides,
  };
}

describe('controller retryTarget endpoint', () => {
  test('POST /campaigns/:id/targets/:targetId/retry re-enqueues a failed job', async () => {
    const { controller, campaignService, jobService, auditService } = createFullStack();

    // Setup: create, add target, launch, fail the job
    const { campaign } = await campaignService.createCampaign({ title: 'Retry', videoAssetId: 'a1' });
    const { target } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1', videoTitle: 'V', videoDescription: 'D',
    });
    await campaignService.markReady(campaign.id);
    await campaignService.launch(campaign.id);
    const [job] = await jobService.enqueueForTargets([{ id: target.id, campaignId: campaign.id }]);
    await jobService.pickNext(); // processing
    await jobService.markFailed(job.id, 'quotaExceeded');
    await campaignService.updateTargetStatus(campaign.id, target.id, 'erro', { errorMessage: 'quotaExceeded' });

    const response = await controller.retryTarget(authRequest({
      params: { id: campaign.id, targetId: target.id },
    }));

    expect(response.status).toBe(200);
    expect(response.body.job!.status).toBe('queued');
    expect(response.body.job!.attempt).toBe(2);

    const auditEvents = await auditService.listEvents();
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      eventType: 'retry_target',
      actorEmail: 'admin@example.com',
      campaignId: campaign.id,
      targetId: target.id,
    });
  });

  test('retry returns 400 when max attempts reached', async () => {
    const { controller, campaignService, jobService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({ title: 'MaxRetry', videoAssetId: 'a1' });
    const { target } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1', videoTitle: 'V', videoDescription: 'D',
    });
    await campaignService.markReady(campaign.id);
    await campaignService.launch(campaign.id);
    const [job] = await jobService.enqueueForTargets([{ id: target.id, campaignId: campaign.id }]);

    // Exhaust all 3 attempts
    await jobService.pickNext();
    await jobService.markFailed(job.id, 'err');
    const r2 = await jobService.retry(job.id);
    if (!('error' in r2)) { await jobService.pickNext(); await jobService.markFailed(r2.id, 'err'); }
    const r3 = await jobService.retry(job.id);
    if (!('error' in r3)) { await jobService.pickNext(); await jobService.markFailed(r3.id, 'err'); }

    const response = await controller.retryTarget(authRequest({
      params: { id: campaign.id, targetId: target.id },
    }));

    expect(response.status).toBe(400);
  });

  test('retry returns 404 for nonexistent target', async () => {
    const { controller, campaignService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({ title: 'NoTarget', videoAssetId: 'a1' });

    const response = await controller.retryTarget(authRequest({
      params: { id: campaign.id, targetId: 'nope' },
    }));

    expect(response.status).toBe(404);
  });

  test('GET /campaigns/:id/targets/:targetId/jobs returns job history for the target', async () => {
    const { controller, campaignService, jobService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({ title: 'History', videoAssetId: 'a1' });
    const { target } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1', videoTitle: 'V', videoDescription: 'D',
    });
    await campaignService.markReady(campaign.id);
    await campaignService.launch(campaign.id);
    const [job] = await jobService.enqueueForTargets([{ id: target.id, campaignId: campaign.id }]);
    await jobService.pickNext();
    await jobService.markFailed(job.id, 'quotaExceeded');

    const response = await controller.getTargetJobs(authRequest({
      params: { id: campaign.id, targetId: target.id },
    }));

    expect(response.status).toBe(200);
    expect(response.body.jobs).toHaveLength(1);
    expect(response.body.jobs[0]).toMatchObject({
      id: job.id,
      campaignTargetId: target.id,
      status: 'failed',
      errorMessage: 'quotaExceeded',
    });
  });

  test('GET /campaigns/:id/jobs returns job history grouped by target for the whole campaign', async () => {
    const { controller, campaignService, jobService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({ title: 'History', videoAssetId: 'a1' });
    const { target: t1 } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1', videoTitle: 'V1', videoDescription: 'D1',
    });
    const { target: t2 } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-2', videoTitle: 'V2', videoDescription: 'D2',
    });
    await campaignService.markReady(campaign.id);
    await campaignService.launch(campaign.id);
    const [job1, job2] = await jobService.enqueueForTargets([
      { id: t1.id, campaignId: campaign.id },
      { id: t2.id, campaignId: campaign.id },
    ]);
    await jobService.pickNext();
    await jobService.markFailed(job1.id, 'quotaExceeded');

    const response = await controller.getCampaignJobs(authRequest({
      params: { id: campaign.id },
    }));

    expect(response.status).toBe(200);
    expect(response.body.jobsByTarget[t1.id]).toHaveLength(1);
    expect(response.body.jobsByTarget[t1.id][0]).toMatchObject({
      id: job1.id,
      campaignTargetId: t1.id,
      status: 'failed',
    });
    expect(response.body.jobsByTarget[t2.id]).toHaveLength(1);
    expect(response.body.jobsByTarget[t2.id][0]).toMatchObject({
      id: job2.id,
      campaignTargetId: t2.id,
      status: 'queued',
    });
  });
});

describe('controller markReady endpoint', () => {
  test('POST /campaigns/:id/ready transitions draft to ready', async () => {
    const { controller, campaignService, auditService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({ title: 'ReadyUp', videoAssetId: 'a1' });
    await campaignService.addTarget(campaign.id, { channelId: 'ch-1', videoTitle: 'V', videoDescription: 'D' });

    const response = await controller.markReady(authRequest({
      params: { id: campaign.id },
    }));

    expect(response.status).toBe(200);
    expect(response.body.campaign!.status).toBe('ready');

    const auditEvents = await auditService.listEvents();
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      eventType: 'mark_ready',
      actorEmail: 'admin@example.com',
      campaignId: campaign.id,
      targetId: null,
    });
  });

  test('markReady rejects campaign without targets', async () => {
    const { controller, campaignService } = createFullStack();

    const { campaign } = await campaignService.createCampaign({ title: 'Empty', videoAssetId: 'a1' });

    const response = await controller.markReady(authRequest({
      params: { id: campaign.id },
    }));

    expect(response.status).toBe(400);
  });

  test('markReady returns 404 for nonexistent campaign', async () => {
    const { controller } = createFullStack();

    const response = await controller.markReady(authRequest({
      params: { id: 'nope' },
    }));

    expect(response.status).toBe(404);
  });
});
