import { describe, expect, test } from 'vitest';

import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';
import { PublishJobService, InMemoryPublishJobRepository } from '../../apps/api/src/campaigns/publish-job.service';
import { DashboardService } from '../../apps/api/src/campaigns/dashboard.service';

function createDashboard() {
  const campaignRepo = new InMemoryCampaignRepository();
  const campaignService = new CampaignService({ repository: campaignRepo });
  const jobRepo = new InMemoryPublishJobRepository();
  const jobService = new PublishJobService({ repository: jobRepo });
  const dashboard = new DashboardService({ campaignService, jobService });

  return { campaignService, jobService, dashboard };
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
  });
});
