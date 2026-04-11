import { describe, expect, test } from 'vitest';

import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';
import { PublishJobService, InMemoryPublishJobRepository } from '../../apps/api/src/campaigns/publish-job.service';
import { CampaignStatusService } from '../../apps/api/src/campaigns/campaign-status.service';

async function setupWithLaunchedCampaign() {
  const campaignRepo = new InMemoryCampaignRepository();
  const campaignService = new CampaignService({ repository: campaignRepo });
  const jobRepo = new InMemoryPublishJobRepository();
  const jobService = new PublishJobService({ repository: jobRepo });

  const { campaign } = await campaignService.createCampaign({
    title: 'Polling Test',
    videoAssetId: 'asset-1',
  });

  const { target: t1 } = await campaignService.addTarget(campaign.id, {
    channelId: 'ch-1',
    videoTitle: 'V1',
    videoDescription: 'D1',
  });

  const { target: t2 } = await campaignService.addTarget(campaign.id, {
    channelId: 'ch-2',
    videoTitle: 'V2',
    videoDescription: 'D2',
  });

  await campaignService.markReady(campaign.id);
  await campaignService.launch(campaign.id);

  const jobs = await jobService.enqueueForTargets([
    { id: t1.id, campaignId: campaign.id },
    { id: t2.id, campaignId: campaign.id },
  ]);

  return { campaignService, jobService, campaign, t1, t2, jobs };
}

describe('campaign status polling', () => {
  test('returns current campaign status with per-target details', async () => {
    const { campaignService, jobService, campaign } = await setupWithLaunchedCampaign();
    const statusService = new CampaignStatusService({ campaignService, jobService });

    const result = await statusService.getStatus(campaign.id);

    expect(result).not.toBeNull();
    expect(result!.campaignStatus).toBe('launching');
    expect(result!.targets).toHaveLength(2);
    expect(result!.targets[0].status).toBe('aguardando');
    expect(result!.targets[0].latestJobStatus).toBe('queued');
  });

  test('reflects target status updates from job completion', async () => {
    const { campaignService, jobService, campaign, t1, jobs } = await setupWithLaunchedCampaign();
    const statusService = new CampaignStatusService({ campaignService, jobService });

    // Simulate job processing & completion
    await jobService.pickNext();
    await jobService.markCompleted(jobs[0].id, 'yt-abc');
    await campaignService.updateTargetStatus(campaign.id, t1.id, 'publicado', { youtubeVideoId: 'yt-abc' });

    const result = await statusService.getStatus(campaign.id);

    const t1Status = result!.targets.find((t) => t.targetId === t1.id);
    expect(t1Status!.status).toBe('publicado');
    expect(t1Status!.youtubeVideoId).toBe('yt-abc');
    expect(t1Status!.latestJobStatus).toBe('completed');
  });

  test('indicates whether polling should continue', async () => {
    const { campaignService, jobService, campaign, t1, t2, jobs } = await setupWithLaunchedCampaign();
    const statusService = new CampaignStatusService({ campaignService, jobService });

    // Nothing done yet — should keep polling
    let result = await statusService.getStatus(campaign.id);
    expect(result!.shouldPoll).toBe(true);

    // Complete all targets
    await jobService.pickNext();
    await jobService.markCompleted(jobs[0].id, 'yt-1');
    await campaignService.updateTargetStatus(campaign.id, t1.id, 'publicado', { youtubeVideoId: 'yt-1' });

    await jobService.pickNext();
    await jobService.markCompleted(jobs[1].id, 'yt-2');
    await campaignService.updateTargetStatus(campaign.id, t2.id, 'publicado', { youtubeVideoId: 'yt-2' });

    result = await statusService.getStatus(campaign.id);
    expect(result!.shouldPoll).toBe(false);
    expect(result!.campaignStatus).toBe('completed');
  });

  test('returns null for non-existent campaign', async () => {
    const campaignService = new CampaignService();
    const jobService = new PublishJobService();
    const statusService = new CampaignStatusService({ campaignService, jobService });

    const result = await statusService.getStatus('nonexistent');
    expect(result).toBeNull();
  });

  test('includes progress counts', async () => {
    const { campaignService, jobService, campaign, t1, jobs } = await setupWithLaunchedCampaign();
    const statusService = new CampaignStatusService({ campaignService, jobService });

    await jobService.pickNext();
    await jobService.markCompleted(jobs[0].id, 'yt-1');
    await campaignService.updateTargetStatus(campaign.id, t1.id, 'publicado', { youtubeVideoId: 'yt-1' });

    const result = await statusService.getStatus(campaign.id);
    expect(result!.progress).toMatchObject({
      completed: 1,
      failed: 0,
      total: 2,
    });
  });

  test('surfaces explicit post-upload warning details for partial failures', async () => {
    const { campaignService, jobService, campaign, t1, jobs } = await setupWithLaunchedCampaign();
    const statusService = new CampaignStatusService({ campaignService, jobService });

    await jobService.pickNext();
    await jobService.markFailed(
      jobs[0].id,
      'Video uploaded as yt-partial-123, but applying the thumbnail failed: forbidden',
      'yt-partial-123',
    );
    await campaignService.updateTargetStatus(campaign.id, t1.id, 'erro', {
      youtubeVideoId: 'yt-partial-123',
      errorMessage: 'Video uploaded as yt-partial-123, but applying the thumbnail failed: forbidden',
    });

    const result = await statusService.getStatus(campaign.id);
    const t1Status = result!.targets.find((t) => t.targetId === t1.id);

    expect(t1Status).toMatchObject({
      status: 'erro',
      youtubeVideoId: 'yt-partial-123',
      hasPostUploadWarning: true,
      reviewYoutubeUrl: 'https://www.youtube.com/watch?v=yt-partial-123',
    });
  });

  test('marks future publishAt targets as scheduledPending and disables polling when nothing is actively running', async () => {
    const campaignRepo = new InMemoryCampaignRepository();
    const campaignService = new CampaignService({ repository: campaignRepo });
    const jobRepo = new InMemoryPublishJobRepository();
    const jobService = new PublishJobService({ repository: jobRepo });
    const statusService = new CampaignStatusService({
      campaignService,
      jobService,
      now: () => new Date('2026-04-10T16:00:00Z'),
    });

    const { campaign } = await campaignService.createCampaign({
      title: 'Scheduled Status',
      videoAssetId: 'asset-1',
    });
    await campaignService.addTarget(campaign.id, {
      channelId: 'ch-1',
      videoTitle: 'Scheduled Target',
      videoDescription: 'Wait for publishAt',
      publishAt: '2026-04-10T18:00:00Z',
    });
    await campaignService.markReady(campaign.id);
    await campaignService.launch(campaign.id);

    const result = await statusService.getStatus(campaign.id);

    expect(result).not.toBeNull();
    expect(result!.shouldPoll).toBe(false);
    expect(result!.nextScheduledAt).toBe('2026-04-10T18:00:00Z');
    expect(result!.targets[0]).toMatchObject({
      status: 'aguardando',
      publishAt: '2026-04-10T18:00:00Z',
      scheduledPending: true,
      latestJobStatus: null,
    });
  });

  test('marks REAUTH_REQUIRED failures explicitly in target status metadata', async () => {
    const { campaignService, jobService, campaign, t1, jobs } = await setupWithLaunchedCampaign();
    const statusService = new CampaignStatusService({ campaignService, jobService });

    await jobService.pickNext();
    await jobService.markFailed(jobs[0].id, 'REAUTH_REQUIRED');
    await campaignService.updateTargetStatus(campaign.id, t1.id, 'erro', {
      errorMessage: 'REAUTH_REQUIRED',
    });

    const result = await statusService.getStatus(campaign.id);
    const t1Status = result!.targets.find((t) => t.targetId === t1.id);

    expect(t1Status).toMatchObject({
      status: 'erro',
      errorMessage: 'REAUTH_REQUIRED',
      reauthRequired: true,
      hasPostUploadWarning: false,
      reviewYoutubeUrl: null,
    });
  });
});
