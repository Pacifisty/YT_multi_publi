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

  return { campaignRepo, campaignService, jobService, auditService, dashboard };
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
    expect(stats.failedJobs).toEqual([]);
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

  test('uses effective campaign status in dashboard totals when stored campaign status is stale', async () => {
    const { campaignRepo, campaignService, dashboard } = createDashboard();

    const { campaign } = await campaignService.createCampaign({ title: 'Stale Status', videoAssetId: 'a1' });
    const { target } = await campaignService.addTarget(campaign.id, { channelId: 'ch-1', videoTitle: 'V1', videoDescription: 'D1' });
    await campaignService.updateTargetStatus(campaign.id, target.id, 'publicado', { youtubeVideoId: 'yt-1' });

    campaignRepo.update(campaign.id, { status: 'launching' });

    const stats = await dashboard.getStats();

    expect(stats.campaigns.byStatus.launching).toBe(0);
    expect(stats.campaigns.byStatus.completed).toBe(1);
  });

  test('counts social targets with external publish ids as completed dashboard work', async () => {
    const { campaignRepo, campaignService, dashboard } = createDashboard();

    const { campaign } = await campaignService.createCampaign({ title: 'Social Done', videoAssetId: 'a1' });
    const { target } = await campaignService.addTarget(campaign.id, {
      platform: 'instagram',
      destinationId: 'ig-account-1',
      destinationLabel: 'Instagram Main',
      connectedAccountId: 'acct-ig',
      videoTitle: 'Reel',
      videoDescription: 'Caption',
    });
    await campaignService.updateTargetStatus(campaign.id, target.id, 'publicado', { externalPublishId: 'ig-media-1' });

    campaignRepo.update(campaign.id, { status: 'launching' });

    const stats = await dashboard.getStats();

    expect(stats.campaigns.byStatus.launching).toBe(0);
    expect(stats.campaigns.byStatus.completed).toBe(1);
    expect(stats.channels).toEqual([
      expect.objectContaining({
        channelId: 'Instagram Main',
        totalTargets: 1,
        published: 1,
        successRate: 100,
      }),
    ]);
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
    expect(main.totalViews).toBe(0);
    expect(main.topVideoId).toBeNull();
    expect(main.topVideoTitle).toBeNull();
    expect(main.topVideoViews).toBe(0);

    const backup = stats.channels.find((c) => c.channelId === 'ch-backup')!;
    expect(backup.totalTargets).toBe(1);
    expect(backup.published).toBe(0);
    expect(backup.failed).toBe(1);
    expect(backup.successRate).toBe(0);
    expect(backup.totalViews).toBe(0);
    expect(backup.topVideoId).toBeNull();
    expect(backup.topVideoTitle).toBeNull();
    expect(backup.topVideoViews).toBe(0);
  });

  test('aggregates per-channel top video and total views when video stats are available', async () => {
    const campaignRepo = new InMemoryCampaignRepository();
    const campaignService = new CampaignService({ repository: campaignRepo });
    const jobRepo = new InMemoryPublishJobRepository();
    const jobService = new PublishJobService({ repository: jobRepo });

    const tokenRequests: string[] = [];
    const statsRequests: Array<{ accessToken: string; videoIds: string[] }> = [];
    const statsByVideoId: Record<string, { title: string; views: number }> = {
      'yt-1': { title: 'Alpha One', views: 140 },
      'yt-2': { title: 'Alpha Two', views: 390 },
      'yt-3': { title: 'Beta One', views: 220 },
    };

    const dashboard = new DashboardService({
      campaignService,
      jobService,
      getAccessTokenForChannel: async (channelId) => {
        tokenRequests.push(channelId);
        return `token:${channelId}`;
      },
      fetchVideoStats: async (accessToken, videoIds) => {
        statsRequests.push({ accessToken, videoIds: [...videoIds] });
        return videoIds.map((videoId) => ({
          videoId,
          title: statsByVideoId[videoId]?.title ?? null,
          views: statsByVideoId[videoId]?.views ?? 0,
        }));
      },
    });

    const { campaign: campaignOne } = await campaignService.createCampaign({ title: 'Views 1', videoAssetId: 'a1' });
    const { target: alphaOne } = await campaignService.addTarget(campaignOne.id, {
      channelId: 'ch-alpha',
      videoTitle: 'Alpha 1',
      videoDescription: 'D1',
    });
    const { target: betaOne } = await campaignService.addTarget(campaignOne.id, {
      channelId: 'ch-beta',
      videoTitle: 'Beta 1',
      videoDescription: 'D3',
    });

    const { campaign: campaignTwo } = await campaignService.createCampaign({ title: 'Views 2', videoAssetId: 'a2' });
    const { target: alphaTwo } = await campaignService.addTarget(campaignTwo.id, {
      channelId: 'ch-alpha',
      videoTitle: 'Alpha 2',
      videoDescription: 'D2',
    });

    await campaignService.updateTargetStatus(campaignOne.id, alphaOne.id, 'publicado', { youtubeVideoId: 'yt-1' });
    await campaignService.updateTargetStatus(campaignOne.id, betaOne.id, 'publicado', { youtubeVideoId: 'yt-3' });
    await campaignService.updateTargetStatus(campaignTwo.id, alphaTwo.id, 'publicado', { youtubeVideoId: 'yt-2' });

    const stats = await dashboard.getStats();

    const alpha = stats.channels.find((channel) => channel.channelId === 'ch-alpha')!;
    expect(alpha.totalViews).toBe(530);
    expect(alpha.topVideoId).toBe('yt-2');
    expect(alpha.topVideoTitle).toBe('Alpha Two');
    expect(alpha.topVideoViews).toBe(390);

    const beta = stats.channels.find((channel) => channel.channelId === 'ch-beta')!;
    expect(beta.totalViews).toBe(220);
    expect(beta.topVideoId).toBe('yt-3');
    expect(beta.topVideoTitle).toBe('Beta One');
    expect(beta.topVideoViews).toBe(220);

    expect(tokenRequests.sort()).toEqual(['ch-alpha', 'ch-beta']);
    expect(statsRequests).toHaveLength(2);
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

  test('builds an actionable failed job queue for dashboard triage', async () => {
    const campaignRepo = new InMemoryCampaignRepository();
    const campaignService = new CampaignService({ repository: campaignRepo });
    const jobRepo = new InMemoryPublishJobRepository();
    let tick = 0;
    const jobService = new PublishJobService({
      repository: jobRepo,
      now: () => new Date(Date.UTC(2026, 3, 28, 12, 0, tick++)),
    });
    const auditRepo = new InMemoryAuditEventRepository();
    const auditService = new AuditEventService({ repository: auditRepo });
    const dashboard = new DashboardService({ campaignService, jobService, auditService });

    const { campaign } = await campaignService.createCampaign({ title: 'Failed Queue', videoAssetId: 'a1' });
    const { target: retryTarget } = await campaignService.addTarget(campaign.id, {
      platform: 'tiktok',
      destinationId: 'tt-account',
      destinationLabel: 'TikTok Main',
      connectedAccountId: 'acct-tt',
      videoTitle: 'TikTok Clip',
      videoDescription: 'Caption',
    });
    const { target: reviewTarget } = await campaignService.addTarget(campaign.id, {
      platform: 'instagram',
      destinationId: 'ig-account',
      destinationLabel: 'Instagram Main',
      connectedAccountId: 'acct-ig',
      videoTitle: 'Instagram Clip',
      videoDescription: 'Caption',
    });
    const { target: reauthTarget } = await campaignService.addTarget(campaign.id, {
      channelId: 'ch-reauth',
      videoTitle: 'YouTube Clip',
      videoDescription: 'Description',
    });

    const [retryJobSeed, reviewJobSeed] = await jobService.enqueueForTargets([
      { id: retryTarget.id, campaignId: campaign.id },
      { id: reviewTarget.id, campaignId: campaign.id },
    ]);
    const retryJob = await jobService.pickNext();
    expect(retryJob?.id).toBe(retryJobSeed.id);
    await jobService.markFailed(retryJob!.id, 'temporarily unavailable', { errorClass: 'transient' });
    await campaignService.updateTargetStatus(campaign.id, retryTarget.id, 'erro', { errorMessage: 'temporarily unavailable' });

    const reviewJob = await jobService.pickNext();
    expect(reviewJob?.id).toBe(reviewJobSeed.id);
    await jobService.markFailed(reviewJob!.id, 'copyright violation', { errorClass: 'permanent' });
    await campaignService.updateTargetStatus(campaign.id, reviewTarget.id, 'erro', { errorMessage: 'copyright violation' });
    await campaignService.updateTargetStatus(campaign.id, reauthTarget.id, 'erro', { errorMessage: 'REAUTH_REQUIRED' });

    const stats = await dashboard.getStats();

    expect(stats.failedJobs).toEqual([
      expect.objectContaining({
        jobId: reviewJob!.id,
        campaignId: campaign.id,
        campaignTitle: 'Failed Queue',
        targetId: reviewTarget.id,
        platform: 'instagram',
        destinationId: 'ig-account',
        destinationLabel: 'Instagram Main',
        videoTitle: 'Instagram Clip',
        errorMessage: 'copyright violation',
        errorClass: 'permanent',
        attempt: 1,
        failedAt: '2026-04-28T12:00:02.000Z',
        suggestedAction: 'review',
      }),
      expect.objectContaining({
        jobId: retryJob!.id,
        targetId: retryTarget.id,
        platform: 'tiktok',
        destinationId: 'tt-account',
        destinationLabel: 'TikTok Main',
        videoTitle: 'TikTok Clip',
        errorClass: 'transient',
        failedAt: '2026-04-28T12:00:01.000Z',
        suggestedAction: 'retry',
      }),
      expect.objectContaining({
        jobId: null,
        targetId: reauthTarget.id,
        platform: 'youtube',
        destinationId: 'ch-reauth',
        videoTitle: 'YouTube Clip',
        errorMessage: 'REAUTH_REQUIRED',
        errorClass: null,
        attempt: null,
        failedAt: null,
        suggestedAction: 'reauth',
      }),
    ]);
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

  test('returns empty platformStats when no campaigns exist', async () => {
    const { dashboard } = createDashboard();
    const stats = await dashboard.getStats();

    expect(stats.platformStats).toEqual([]);
  });

  test('calculates platformStats with multiple platforms', async () => {
    const { campaignService, dashboard } = createDashboard();

    // Create YouTube campaign: 2 targets, 1 published, 1 failed
    const { campaign: c1 } = await campaignService.createCampaign({ title: 'YouTube Mixed', videoAssetId: 'a1' });
    const { target: ytSuccess } = await campaignService.addTarget(c1.id, {
      platform: 'youtube',
      channelId: 'ch-yt-1',
      videoTitle: 'YT Video 1',
      videoDescription: 'D1',
    });
    const { target: ytFail } = await campaignService.addTarget(c1.id, {
      platform: 'youtube',
      channelId: 'ch-yt-2',
      videoTitle: 'YT Video 2',
      videoDescription: 'D2',
    });
    await campaignService.updateTargetStatus(c1.id, ytSuccess.id, 'publicado', { youtubeVideoId: 'yt-1' });
    await campaignService.updateTargetStatus(c1.id, ytFail.id, 'erro', { errorMessage: 'quota' });

    // Create TikTok campaign: 2 targets, both published
    const { campaign: c2 } = await campaignService.createCampaign({ title: 'TikTok Success', videoAssetId: 'a2' });
    const { target: ttSuccess1 } = await campaignService.addTarget(c2.id, {
      platform: 'tiktok',
      destinationId: 'tt-acc-1',
      destinationLabel: 'TikTok Account 1',
      connectedAccountId: 'acct-tt-1',
      videoTitle: 'TT Video 1',
      videoDescription: 'D3',
    });
    const { target: ttSuccess2 } = await campaignService.addTarget(c2.id, {
      platform: 'tiktok',
      destinationId: 'tt-acc-2',
      destinationLabel: 'TikTok Account 2',
      connectedAccountId: 'acct-tt-2',
      videoTitle: 'TT Video 2',
      videoDescription: 'D4',
    });
    await campaignService.updateTargetStatus(c2.id, ttSuccess1.id, 'publicado', { externalPublishId: 'tt-media-1' });
    await campaignService.updateTargetStatus(c2.id, ttSuccess2.id, 'publicado', { externalPublishId: 'tt-media-2' });

    const stats = await dashboard.getStats();

    expect(stats.platformStats).toHaveLength(2);

    // Platforms should be sorted by published count descending (TikTok: 2, YouTube: 1)
    expect(stats.platformStats[0]).toEqual(
      expect.objectContaining({
        platform: 'tiktok',
        totalTargets: 2,
        published: 2,
        failed: 0,
        successRate: 100,
        retriedTargets: 0,
        topRetryDestination: null,
      }),
    );

    expect(stats.platformStats[1]).toEqual(
      expect.objectContaining({
        platform: 'youtube',
        totalTargets: 2,
        published: 1,
        failed: 1,
        successRate: 50,
        retriedTargets: 0,
        topRetryDestination: null,
      }),
    );
  });

  test('calculates destinationStats with retry counts', async () => {
    const campaignRepo = new InMemoryCampaignRepository();
    const campaignService = new CampaignService({ repository: campaignRepo });
    const jobRepo = new InMemoryPublishJobRepository();
    const jobService = new PublishJobService({ repository: jobRepo });
    const dashboard = new DashboardService({ campaignService, jobService });

    // YouTube target that succeeds
    const { campaign: c1 } = await campaignService.createCampaign({ title: 'YouTube', videoAssetId: 'a1' });
    const { target: ytTarget } = await campaignService.addTarget(c1.id, {
      platform: 'youtube',
      channelId: 'ch-yt-main',
      videoTitle: 'YT Video',
      videoDescription: 'D1',
    });
    await campaignService.updateTargetStatus(c1.id, ytTarget.id, 'publicado', { youtubeVideoId: 'yt-1' });

    // TikTok target that fails and gets retried
    const { campaign: c2 } = await campaignService.createCampaign({ title: 'TikTok', videoAssetId: 'a2' });
    const { target: ttTarget } = await campaignService.addTarget(c2.id, {
      platform: 'tiktok',
      destinationId: 'tiktok-1',
      destinationLabel: 'TikTok Main',
      connectedAccountId: 'acct-tt',
      videoTitle: 'TT Video',
      videoDescription: 'D2',
    });
    await campaignService.updateTargetStatus(c2.id, ttTarget.id, 'erro', { errorMessage: 'temporarily unavailable' });

    // Enqueue job for TikTok target and retry it
    const [ttJob] = await jobService.enqueueForTargets([{ id: ttTarget.id, campaignId: c2.id }]);
    await jobService.pickNext();
    await jobService.markFailed(ttJob.id, 'temporarily unavailable');
    await jobService.retry(ttJob.id); // attempt 2

    const stats = await dashboard.getStats();

    // Should have both destinations
    expect(stats.destinationStats.length).toBeGreaterThanOrEqual(2);

    const ytDest = stats.destinationStats.find((d) => d.platform === 'youtube' && d.destinationId === 'ch-yt-main');
    expect(ytDest).toEqual(
      expect.objectContaining({
        destinationId: 'ch-yt-main',
        platform: 'youtube',
        totalTargets: 1,
        published: 1,
        failed: 0,
        successRate: 100,
        retriedCount: 0,
        latestFailureMessage: null,
      }),
    );

    const ttDest = stats.destinationStats.find((d) => d.platform === 'tiktok' && d.destinationId === 'tiktok-1');
    expect(ttDest).toEqual(
      expect.objectContaining({
        destinationId: 'tiktok-1',
        destinationLabel: 'TikTok Main',
        platform: 'tiktok',
        totalTargets: 1,
        published: 0,
        failed: 1,
        successRate: 0,
        retriedCount: 1,
        latestFailureMessage: 'temporarily unavailable',
      }),
    );
  });
});
