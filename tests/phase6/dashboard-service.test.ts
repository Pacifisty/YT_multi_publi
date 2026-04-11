import { describe, expect, test } from 'vitest';

import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';
import { PublishJobService, InMemoryPublishJobRepository } from '../../apps/api/src/campaigns/publish-job.service';
import { AuditEventService, InMemoryAuditEventRepository } from '../../apps/api/src/campaigns/audit-event.service';
import { DashboardService } from '../../apps/api/src/campaigns/dashboard.service';

function createDashboard() {
  const campaignRepo = new InMemoryCampaignRepository();
  const campaignService = new CampaignService({ repository: campaignRepo });
  const jobRepo = new InMemoryPublishJobRepository();
  const jobService = new PublishJobService({ repository: jobRepo });
  const auditRepo = new InMemoryAuditEventRepository();
  const auditService = new AuditEventService({ repository: auditRepo });
  const dashboard = new DashboardService({ campaignService, jobService, auditService });

  return { campaignService, jobService, auditService, dashboard };
}

describe('DashboardService.getStats', () => {
  test('returns zeroes when no campaigns exist', async () => {
    const { dashboard } = createDashboard();
    const stats = await dashboard.getStats();

    expect(stats.campaigns.total).toBe(0);
    expect(stats.campaigns.byStatus).toEqual({ draft: 0, ready: 0, launching: 0, completed: 0, failed: 0 });
    expect(stats.targets.total).toBe(0);
    expect(stats.targets.successRate).toBe(0);
    expect(stats.targets.byStatus).toEqual({ aguardando: 0, enviando: 0, publicado: 0, erro: 0 });
    expect(stats.quota).toEqual({
      dailyLimitUnits: 10000,
      estimatedConsumedUnits: 0,
      estimatedQueuedUnits: 0,
      estimatedProjectedUnits: 0,
      estimatedRemainingUnits: 10000,
      usagePercent: 0,
      projectedPercent: 0,
      warningState: 'healthy',
    });
    expect(stats.failures).toEqual({
      failedCampaigns: 0,
      failedTargets: 0,
      topReason: null,
      reasons: [],
    });
    expect(stats.retries).toEqual({
      retriedTargets: 0,
      highestAttempt: 0,
      hotspotChannelId: null,
      hotspotRetryCount: 0,
    });
    expect(stats.audit).toEqual({
      totalEvents: 0,
      byType: { launch_campaign: 0, retry_target: 0, mark_ready: 0, clone_campaign: 0, delete_campaign: 0, update_campaign: 0, remove_target: 0, update_target: 0, add_target: 0, add_targets_bulk: 0, publish_completed: 0, publish_failed: 0, publish_partial_failure: 0 },
      lastEventAt: null,
      lastEventType: null,
      lastActorEmail: null,
    });
    expect(stats.channels).toHaveLength(0);
  });

  test('counts campaigns by status', async () => {
    const { campaignService, dashboard } = createDashboard();

    await campaignService.createCampaign({ title: 'Draft', videoAssetId: 'a1' });
    const { campaign: c2 } = await campaignService.createCampaign({ title: 'Ready', videoAssetId: 'a2' });
    await campaignService.addTarget(c2.id, { channelId: 'ch-1', videoTitle: 'V', videoDescription: 'D' });
    await campaignService.markReady(c2.id);

    const stats = await dashboard.getStats();

    expect(stats.campaigns.total).toBe(2);
    expect(stats.campaigns.byStatus.draft).toBe(1);
    expect(stats.campaigns.byStatus.ready).toBe(1);
  });

  test('calculates target success rate', async () => {
    const { campaignService, dashboard } = createDashboard();

    const { campaign } = await campaignService.createCampaign({ title: 'Mixed', videoAssetId: 'a1' });
    const { target: t1 } = await campaignService.addTarget(campaign.id, { channelId: 'ch-1', videoTitle: 'V1', videoDescription: 'D1' });
    const { target: t2 } = await campaignService.addTarget(campaign.id, { channelId: 'ch-2', videoTitle: 'V2', videoDescription: 'D2' });
    const { target: t3 } = await campaignService.addTarget(campaign.id, { channelId: 'ch-3', videoTitle: 'V3', videoDescription: 'D3' });

    await campaignService.updateTargetStatus(campaign.id, t1.id, 'publicado', { youtubeVideoId: 'yt-1' });
    await campaignService.updateTargetStatus(campaign.id, t2.id, 'publicado', { youtubeVideoId: 'yt-2' });
    await campaignService.updateTargetStatus(campaign.id, t3.id, 'erro', { errorMessage: 'quota' });

    const stats = await dashboard.getStats();

    expect(stats.targets.total).toBe(3);
    expect(stats.targets.byStatus.publicado).toBe(2);
    expect(stats.targets.byStatus.erro).toBe(1);
    expect(stats.targets.successRate).toBeCloseTo(66.67, 1);
  });

  test('aggregates per-channel metrics', async () => {
    const { campaignService, dashboard } = createDashboard();

    // Campaign 1: ch-main succeeds, ch-backup fails
    const { campaign: c1 } = await campaignService.createCampaign({ title: 'C1', videoAssetId: 'a1' });
    const { target: t1 } = await campaignService.addTarget(c1.id, { channelId: 'ch-main', videoTitle: 'V1', videoDescription: 'D' });
    const { target: t2 } = await campaignService.addTarget(c1.id, { channelId: 'ch-backup', videoTitle: 'V2', videoDescription: 'D' });
    await campaignService.updateTargetStatus(c1.id, t1.id, 'publicado', { youtubeVideoId: 'yt-1' });
    await campaignService.updateTargetStatus(c1.id, t2.id, 'erro', { errorMessage: 'fail' });

    // Campaign 2: ch-main succeeds again
    const { campaign: c2 } = await campaignService.createCampaign({ title: 'C2', videoAssetId: 'a2' });
    const { target: t3 } = await campaignService.addTarget(c2.id, { channelId: 'ch-main', videoTitle: 'V3', videoDescription: 'D' });
    await campaignService.updateTargetStatus(c2.id, t3.id, 'publicado', { youtubeVideoId: 'yt-3' });

    const stats = await dashboard.getStats();

    expect(stats.channels).toHaveLength(2);

    const main = stats.channels.find((c) => c.channelId === 'ch-main')!;
    expect(main.totalTargets).toBe(2);
    expect(main.published).toBe(2);
    expect(main.failed).toBe(0);
    expect(main.successRate).toBe(100);

    const backup = stats.channels.find((c) => c.channelId === 'ch-backup')!;
    expect(backup.totalTargets).toBe(1);
    expect(backup.published).toBe(0);
    expect(backup.failed).toBe(1);
    expect(backup.successRate).toBe(0);
  });

  test('includes job statistics', async () => {
    const { campaignService, jobService, dashboard } = createDashboard();

    const { campaign } = await campaignService.createCampaign({ title: 'Jobs', videoAssetId: 'a1' });
    const { target: t1 } = await campaignService.addTarget(campaign.id, { channelId: 'ch-1', videoTitle: 'V1', videoDescription: 'D1' });
    const { target: t2 } = await campaignService.addTarget(campaign.id, { channelId: 'ch-2', videoTitle: 'V2', videoDescription: 'D2' });

    const jobs = await jobService.enqueueForTargets([
      { id: t1.id, campaignId: campaign.id },
      { id: t2.id, campaignId: campaign.id },
    ]);

    const j1 = await jobService.pickNext()!;
    await jobService.markCompleted(j1.id, 'yt-1');
    const j2 = await jobService.pickNext()!;
    await jobService.markFailed(j2.id, 'error');

    const stats = await dashboard.getStats();

    expect(stats.jobs.total).toBe(2);
    expect(stats.jobs.byStatus).toEqual({ queued: 0, processing: 0, completed: 1, failed: 1 });
    expect(stats.jobs.totalRetries).toBe(0);
  });

  test('counts retries across jobs', async () => {
    const { campaignService, jobService, dashboard } = createDashboard();

    const { campaign } = await campaignService.createCampaign({ title: 'Retries', videoAssetId: 'a1' });
    const { target } = await campaignService.addTarget(campaign.id, { channelId: 'ch-1', videoTitle: 'V', videoDescription: 'D' });

    const [job] = await jobService.enqueueForTargets([{ id: target.id, campaignId: campaign.id }]);
    await jobService.pickNext();
    await jobService.markFailed(job.id, 'err');
    await jobService.retry(job.id); // attempt 2
    await jobService.pickNext();
    await jobService.markFailed(job.id, 'err');
    await jobService.retry(job.id); // attempt 3

    const stats = await dashboard.getStats();

    expect(stats.jobs.totalRetries).toBe(2);
    expect(stats.retries).toEqual({
      retriedTargets: 1,
      highestAttempt: 3,
      hotspotChannelId: 'ch-1',
      hotspotRetryCount: 2,
    });
  });

  test('aggregates reauth-required targets into dedicated dashboard stats', async () => {
    const { campaignService, dashboard } = createDashboard();

    const { campaign: c1 } = await campaignService.createCampaign({ title: 'Needs Reauth 1', videoAssetId: 'a1' });
    const { target: t1 } = await campaignService.addTarget(c1.id, { channelId: 'ch-reauth-1', videoTitle: 'V1', videoDescription: 'D1' });
    const { target: t2 } = await campaignService.addTarget(c1.id, { channelId: 'ch-ok', videoTitle: 'V2', videoDescription: 'D2' });
    await campaignService.updateTargetStatus(c1.id, t1.id, 'erro', { errorMessage: 'REAUTH_REQUIRED' });
    await campaignService.updateTargetStatus(c1.id, t2.id, 'publicado', { youtubeVideoId: 'yt-2' });

    const { campaign: c2 } = await campaignService.createCampaign({ title: 'Needs Reauth 2', videoAssetId: 'a2' });
    const { target: t3 } = await campaignService.addTarget(c2.id, { channelId: 'ch-reauth-2', videoTitle: 'V3', videoDescription: 'D3' });
    const { target: t4 } = await campaignService.addTarget(c2.id, { channelId: 'ch-fail', videoTitle: 'V4', videoDescription: 'D4' });
    await campaignService.updateTargetStatus(c2.id, t3.id, 'erro', { errorMessage: 'REAUTH_REQUIRED' });
    await campaignService.updateTargetStatus(c2.id, t4.id, 'erro', { errorMessage: 'quotaExceeded' });

    const stats = await dashboard.getStats();

    expect(stats.reauth).toEqual({
      blockedCampaigns: 2,
      blockedTargets: 2,
      blockedChannelCount: 2,
      blockedChannelIds: ['ch-reauth-1', 'ch-reauth-2'],
    });
  });

  test('estimates quota consumption from started uploads, queued uploads, and post-upload operations', async () => {
    const { campaignService, jobService, dashboard } = createDashboard();

    const { campaign } = await campaignService.createCampaign({ title: 'Quota', videoAssetId: 'a1' });
    const { target: startedTarget } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-started',
      videoTitle: 'V1',
      videoDescription: 'D1',
      playlistId: 'playlist-1',
      thumbnailAssetId: 'thumb-1',
    });
    const { target: queuedTarget } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-queued',
      videoTitle: 'V2',
      videoDescription: 'D2',
    });

    const jobs = await jobService.enqueueForTargets([
      { id: startedTarget.id, campaignId: campaign.id },
      { id: queuedTarget.id, campaignId: campaign.id },
    ]);

    await jobService.pickNext();
    await jobService.markCompleted(jobs[0].id, 'yt-1');
    await campaignService.updateTargetStatus(campaign.id, startedTarget.id, 'publicado', { youtubeVideoId: 'yt-1' });

    const stats = await dashboard.getStats();

    expect(stats.quota).toEqual({
      dailyLimitUnits: 10000,
      estimatedConsumedUnits: 200,
      estimatedQueuedUnits: 100,
      estimatedProjectedUnits: 300,
      estimatedRemainingUnits: 9800,
      usagePercent: 2,
      projectedPercent: 3,
      warningState: 'healthy',
    });
  });

  test('raises a warning when projected quota approaches the daily limit', async () => {
    const { campaignService, jobService, dashboard } = createDashboard();

    const { campaign } = await campaignService.createCampaign({ title: 'Quota Warning', videoAssetId: 'a1' });

    const targets: { id: string; campaignId: string }[] = [];
    for (let index = 0; index < 80; index += 1) {
      const { target } = await campaignService.addTarget(campaign.id, {
        channelId: `ch-${index}`,
        videoTitle: `Video ${index}`,
        videoDescription: `Description ${index}`,
      });
      targets.push({ id: target.id, campaignId: campaign.id });
    }

    await jobService.enqueueForTargets(targets);

    const stats = await dashboard.getStats();

    expect(stats.quota.dailyLimitUnits).toBe(10000);
    expect(stats.quota.estimatedConsumedUnits).toBe(0);
    expect(stats.quota.estimatedQueuedUnits).toBe(8000);
    expect(stats.quota.estimatedProjectedUnits).toBe(8000);
    expect(stats.quota.estimatedRemainingUnits).toBe(10000);
    expect(stats.quota.usagePercent).toBe(0);
    expect(stats.quota.projectedPercent).toBe(80);
    expect(stats.quota.warningState).toBe('warning');
  });

  test('aggregates non-reauth failure reasons for dashboard review', async () => {
    const { campaignService, dashboard } = createDashboard();

    const { campaign: c1 } = await campaignService.createCampaign({ title: 'Failures 1', videoAssetId: 'a1' });
    const { target: t1 } = await campaignService.addTarget(c1.id, {
      channelId: 'ch-quota-1',
      videoTitle: 'V1',
      videoDescription: 'D1',
    });
    const { target: t2 } = await campaignService.addTarget(c1.id, {
      channelId: 'ch-partial',
      videoTitle: 'V2',
      videoDescription: 'D2',
      playlistId: 'playlist-1',
    });
    await campaignService.updateTargetStatus(c1.id, t1.id, 'erro', { errorMessage: 'quotaExceeded' });
    await campaignService.updateTargetStatus(c1.id, t2.id, 'erro', {
      errorMessage: 'Video uploaded as yt-123, but adding it to playlist failed: forbidden',
    });

    const { campaign: c2 } = await campaignService.createCampaign({ title: 'Failures 2', videoAssetId: 'a2' });
    const { target: t3 } = await campaignService.addTarget(c2.id, {
      channelId: 'ch-quota-2',
      videoTitle: 'V3',
      videoDescription: 'D3',
    });
    const { target: t4 } = await campaignService.addTarget(c2.id, {
      channelId: 'ch-reauth',
      videoTitle: 'V4',
      videoDescription: 'D4',
    });
    await campaignService.updateTargetStatus(c2.id, t3.id, 'erro', { errorMessage: 'quotaExceeded' });
    await campaignService.updateTargetStatus(c2.id, t4.id, 'erro', { errorMessage: 'REAUTH_REQUIRED' });

    const stats = await dashboard.getStats();

    expect(stats.failures).toEqual({
      failedCampaigns: 2,
      failedTargets: 3,
      topReason: 'quota_exceeded',
      reasons: [
        { reason: 'quota_exceeded', count: 2 },
        { reason: 'post_upload_step_failed', count: 1 },
      ],
    });
  });

  test('aggregates audit activity for launch and retry actions', async () => {
    const { auditService, dashboard } = createDashboard();

    await auditService.record({
      eventType: 'mark_ready',
      actorEmail: 'admin@test.com',
      campaignId: 'c1',
      targetId: null,
    });
    await auditService.record({
      eventType: 'add_target',
      actorEmail: 'admin@test.com',
      campaignId: 'c1',
      targetId: 't0',
    });
    await auditService.record({
      eventType: 'add_targets_bulk',
      actorEmail: 'admin@test.com',
      campaignId: 'c1',
      targetId: null,
    });
    await auditService.record({
      eventType: 'publish_completed',
      actorEmail: 'system@internal',
      campaignId: 'c1',
      targetId: 't-published',
    });
    await auditService.record({
      eventType: 'publish_failed',
      actorEmail: 'system@internal',
      campaignId: 'c1',
      targetId: 't-failed',
    });
    await auditService.record({
      eventType: 'publish_partial_failure',
      actorEmail: 'system@internal',
      campaignId: 'c1',
      targetId: 't-partial',
    });
    await auditService.record({
      eventType: 'launch_campaign',
      actorEmail: 'admin@test.com',
      campaignId: 'c1',
      targetId: null,
    });
    await auditService.record({
      eventType: 'clone_campaign',
      actorEmail: 'admin@test.com',
      campaignId: 'c1',
      targetId: null,
    });
    await auditService.record({
      eventType: 'update_campaign',
      actorEmail: 'admin@test.com',
      campaignId: 'c1',
      targetId: null,
    });
    await auditService.record({
      eventType: 'retry_target',
      actorEmail: 'admin@test.com',
      campaignId: 'c1',
      targetId: 't1',
    });
    await auditService.record({
      eventType: 'remove_target',
      actorEmail: 'admin@test.com',
      campaignId: 'c1',
      targetId: 't2',
    });
    await auditService.record({
      eventType: 'update_target',
      actorEmail: 'admin@test.com',
      campaignId: 'c1',
      targetId: 't3',
    });
    await auditService.record({
      eventType: 'delete_campaign',
      actorEmail: 'admin@test.com',
      campaignId: 'c2',
      targetId: null,
    });

    const stats = await dashboard.getStats();

    expect(stats.audit.totalEvents).toBe(13);
    expect(stats.audit.byType).toEqual({
      launch_campaign: 1,
      retry_target: 1,
      mark_ready: 1,
      clone_campaign: 1,
      delete_campaign: 1,
      update_campaign: 1,
      remove_target: 1,
      update_target: 1,
      add_target: 1,
      add_targets_bulk: 1,
      publish_completed: 1,
      publish_failed: 1,
      publish_partial_failure: 1,
    });
    expect(stats.audit.lastEventType).toBe('delete_campaign');
    expect(stats.audit.lastActorEmail).toBe('admin@test.com');
    expect(stats.audit.lastEventAt).toBeTruthy();
  });
});
