import { describe, expect, test, vi } from 'vitest';

import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';
import { PublishJobService, InMemoryPublishJobRepository } from '../../apps/api/src/campaigns/publish-job.service';
import { LaunchService } from '../../apps/api/src/campaigns/launch.service';
import { YouTubeUploadWorker } from '../../apps/api/src/campaigns/youtube-upload.worker';
import { JobRunner } from '../../apps/api/src/campaigns/job-runner';

function createE2EStack(uploadFn?: (ctx: any) => Promise<{ videoId: string }>) {
  const campaignRepo = new InMemoryCampaignRepository();
  const campaignService = new CampaignService({ repository: campaignRepo });
  const jobRepo = new InMemoryPublishJobRepository();
  const jobService = new PublishJobService({ repository: jobRepo });
  const launchService = new LaunchService({ campaignService, jobService });

  const mockUpload = uploadFn ?? vi.fn().mockImplementation(async (ctx: any) => ({
    videoId: `yt-${ctx.title.replace(/\s+/g, '-').toLowerCase()}`,
  }));

  const worker = new YouTubeUploadWorker({
    jobService,
    campaignService,
    uploadFn: mockUpload as any,
    getAccessToken: async () => 'mock-token',
    getVideoFilePath: async () => '/tmp/video.mp4',
  });

  const runner = new JobRunner({ worker });

  return { campaignService, jobService, launchService, worker, runner, mockUpload };
}

describe('JobRunner processes all queued jobs', () => {
  test('processAll drains the queue and returns results', async () => {
    const { campaignService, launchService, runner } = createE2EStack();

    const { campaign } = await campaignService.createCampaign({ title: 'Runner', videoAssetId: 'a1' });
    await campaignService.addTarget(campaign.id, { channelId: 'ch-1', videoTitle: 'V1', videoDescription: 'D1' });
    await campaignService.addTarget(campaign.id, { channelId: 'ch-2', videoTitle: 'V2', videoDescription: 'D2' });
    await campaignService.markReady(campaign.id);
    await launchService.launchCampaign(campaign.id);

    const results = await runner.processAll();

    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === 'completed')).toBe(true);
  });

  test('processAll returns empty array when no jobs queued', async () => {
    const { runner } = createE2EStack();

    const results = await runner.processAll();
    expect(results).toHaveLength(0);
  });

  test('processAll handles mixed success and failure', async () => {
    let callCount = 0;
    const { campaignService, launchService, runner } = createE2EStack(async (ctx) => {
      callCount++;
      if (callCount === 2) throw new Error('quotaExceeded');
      return { videoId: `yt-${callCount}` };
    });

    const { campaign } = await campaignService.createCampaign({ title: 'Mixed', videoAssetId: 'a1' });
    await campaignService.addTarget(campaign.id, { channelId: 'ch-1', videoTitle: 'V1', videoDescription: 'D1' });
    await campaignService.addTarget(campaign.id, { channelId: 'ch-2', videoTitle: 'V2', videoDescription: 'D2' });
    await campaignService.markReady(campaign.id);
    await launchService.launchCampaign(campaign.id);

    const results = await runner.processAll();

    expect(results).toHaveLength(2);
    const completed = results.filter((r) => r.status === 'completed');
    const failed = results.filter((r) => r.status === 'failed');
    expect(completed).toHaveLength(1);
    expect(failed).toHaveLength(1);
  });
});

describe('E2E: full publish flow', () => {
  test('create → targets → ready → launch → process → campaign completed', async () => {
    const { campaignService, launchService, runner } = createE2EStack();

    // 1. Create campaign
    const { campaign } = await campaignService.createCampaign({ title: 'Full Flow', videoAssetId: 'asset-1' });
    expect(campaign.status).toBe('draft');

    // 2. Add targets
    await campaignService.addTarget(campaign.id, {
      channelId: 'ch-main', videoTitle: 'Main Upload', videoDescription: 'Main desc',
      tags: ['test'], privacy: 'public',
    });
    await campaignService.addTarget(campaign.id, {
      channelId: 'ch-backup', videoTitle: 'Backup Upload', videoDescription: 'Backup desc',
    });

    // 3. Mark ready
    const readyResult = await campaignService.markReady(campaign.id);
    expect('campaign' in readyResult && readyResult.campaign.status).toBe('ready');

    // 4. Launch (enqueues jobs)
    const launchResult = await launchService.launchCampaign(campaign.id);
    expect('campaign' in launchResult && launchResult.campaign.status).toBe('launching');

    // 5. Process all jobs
    const results = await runner.processAll();
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.status === 'completed')).toBe(true);

    // 6. Verify campaign completed
    const final = await campaignService.getCampaign(campaign.id);
    expect(final!.campaign.status).toBe('completed');

    // 7. Verify targets have YouTube video IDs
    expect(final!.campaign.targets[0].status).toBe('publicado');
    expect(final!.campaign.targets[0].youtubeVideoId).toBeTruthy();
    expect(final!.campaign.targets[1].status).toBe('publicado');
    expect(final!.campaign.targets[1].youtubeVideoId).toBeTruthy();
  });

  test('create → launch → partial failure → retry → all completed', async () => {
    let callCount = 0;
    const { campaignService, jobService, launchService, runner } = createE2EStack(async (ctx) => {
      callCount++;
      // Fail on the first attempt for the second target
      if (callCount === 2) throw new Error('quotaExceeded');
      return { videoId: `yt-${callCount}` };
    });

    // Setup and launch
    const { campaign } = await campaignService.createCampaign({ title: 'Retry Flow', videoAssetId: 'asset-1' });
    await campaignService.addTarget(campaign.id, { channelId: 'ch-1', videoTitle: 'V1', videoDescription: 'D1' });
    await campaignService.addTarget(campaign.id, { channelId: 'ch-2', videoTitle: 'V2', videoDescription: 'D2' });
    await campaignService.markReady(campaign.id);
    await launchService.launchCampaign(campaign.id);

    // First pass — one succeeds, one fails
    await runner.processAll();

    const afterFirst = await campaignService.getCampaign(campaign.id)!;
    // Campaign completes because all targets reached terminal status (1 publicado + 1 erro)
    expect(afterFirst.campaign.status).toBe('completed');
    const failedTarget = afterFirst.campaign.targets.find((t) => t.status === 'erro')!;
    expect(failedTarget).toBeDefined();
    expect(failedTarget.errorMessage).toBe('quotaExceeded');

    // Retry the failed target's job
    const failedJobs = await jobService.getJobsForTarget(failedTarget.id);
    const failedJob = failedJobs.find((j) => j.status === 'failed')!;
    await jobService.retry(failedJob.id);
    await campaignService.updateTargetStatus(campaign.id, failedTarget.id, 'aguardando', { errorMessage: null });

    // Second pass — retry succeeds
    await runner.processAll();

    const final = await campaignService.getCampaign(campaign.id)!;
    expect(final.campaign.targets.every((t) => t.status === 'publicado')).toBe(true);
    expect(final.campaign.status).toBe('completed');
  });

  test('scheduled campaign auto-launches and completes', async () => {
    const { ScheduledLaunchChecker } = await import('../../apps/api/src/campaigns/scheduled-launch-checker');
    const now = new Date('2026-04-10T16:00:00Z');
    const { campaignService, launchService, runner } = createE2EStack();

    const checker = new ScheduledLaunchChecker({
      campaignService,
      launchService,
      now: () => now,
    });

    // Create scheduled campaign
    const { campaign } = await campaignService.createCampaign({
      title: 'Scheduled E2E',
      videoAssetId: 'a1',
      scheduledAt: '2026-04-10T15:00:00Z',
    });
    await campaignService.addTarget(campaign.id, { channelId: 'ch-1', videoTitle: 'V1', videoDescription: 'D1' });
    await campaignService.markReady(campaign.id);

    // Checker auto-launches
    const launched = await checker.checkAndLaunch();
    expect(launched).toHaveLength(1);

    // Process jobs
    await runner.processAll();

    // Verify completed
    const final = await campaignService.getCampaign(campaign.id)!;
    expect(final.campaign.status).toBe('completed');
    expect(final.campaign.targets[0].status).toBe('publicado');
  });
});
