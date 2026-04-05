import { describe, expect, test } from 'vitest';

import { CampaignService, InMemoryCampaignRepository } from '../../apps/api/src/campaigns/campaign.service';
import { PublishJobService, InMemoryPublishJobRepository } from '../../apps/api/src/campaigns/publish-job.service';
import { CampaignStatusService } from '../../apps/api/src/campaigns/campaign-status.service';

function setupWithLaunchedCampaign() {
  const campaignRepo = new InMemoryCampaignRepository();
  const campaignService = new CampaignService({ repository: campaignRepo });
  const jobRepo = new InMemoryPublishJobRepository();
  const jobService = new PublishJobService({ repository: jobRepo });

  const { campaign } = campaignService.createCampaign({
    title: 'Polling Test',
    videoAssetId: 'asset-1',
  });

  const { target: t1 } = campaignService.addTarget(campaign.id, {
    channelId: 'ch-1',
    videoTitle: 'V1',
    videoDescription: 'D1',
  });

  const { target: t2 } = campaignService.addTarget(campaign.id, {
    channelId: 'ch-2',
    videoTitle: 'V2',
    videoDescription: 'D2',
  });

  campaignService.markReady(campaign.id);
  campaignService.launch(campaign.id);

  const jobs = jobService.enqueueForTargets([
    { id: t1.id, campaignId: campaign.id },
    { id: t2.id, campaignId: campaign.id },
  ]);

  return { campaignService, jobService, campaign, t1, t2, jobs };
}

describe('campaign status polling', () => {
  test('returns current campaign status with per-target details', () => {
    const { campaignService, jobService, campaign } = setupWithLaunchedCampaign();
    const statusService = new CampaignStatusService({ campaignService, jobService });

    const result = statusService.getStatus(campaign.id);

    expect(result).not.toBeNull();
    expect(result!.campaignStatus).toBe('launching');
    expect(result!.targets).toHaveLength(2);
    expect(result!.targets[0].status).toBe('aguardando');
    expect(result!.targets[0].latestJobStatus).toBe('queued');
  });

  test('reflects target status updates from job completion', () => {
    const { campaignService, jobService, campaign, t1, jobs } = setupWithLaunchedCampaign();
    const statusService = new CampaignStatusService({ campaignService, jobService });

    // Simulate job processing & completion
    jobService.pickNext();
    jobService.markCompleted(jobs[0].id, 'yt-abc');
    campaignService.updateTargetStatus(campaign.id, t1.id, 'publicado', { youtubeVideoId: 'yt-abc' });

    const result = statusService.getStatus(campaign.id);

    const t1Status = result!.targets.find((t) => t.targetId === t1.id);
    expect(t1Status!.status).toBe('publicado');
    expect(t1Status!.youtubeVideoId).toBe('yt-abc');
    expect(t1Status!.latestJobStatus).toBe('completed');
  });

  test('indicates whether polling should continue', () => {
    const { campaignService, jobService, campaign, t1, t2, jobs } = setupWithLaunchedCampaign();
    const statusService = new CampaignStatusService({ campaignService, jobService });

    // Nothing done yet — should keep polling
    let result = statusService.getStatus(campaign.id);
    expect(result!.shouldPoll).toBe(true);

    // Complete all targets
    jobService.pickNext();
    jobService.markCompleted(jobs[0].id, 'yt-1');
    campaignService.updateTargetStatus(campaign.id, t1.id, 'publicado', { youtubeVideoId: 'yt-1' });

    jobService.pickNext();
    jobService.markCompleted(jobs[1].id, 'yt-2');
    campaignService.updateTargetStatus(campaign.id, t2.id, 'publicado', { youtubeVideoId: 'yt-2' });

    result = statusService.getStatus(campaign.id);
    expect(result!.shouldPoll).toBe(false);
    expect(result!.campaignStatus).toBe('completed');
  });

  test('returns null for non-existent campaign', () => {
    const campaignService = new CampaignService();
    const jobService = new PublishJobService();
    const statusService = new CampaignStatusService({ campaignService, jobService });

    const result = statusService.getStatus('nonexistent');
    expect(result).toBeNull();
  });

  test('includes progress counts', () => {
    const { campaignService, jobService, campaign, t1, jobs } = setupWithLaunchedCampaign();
    const statusService = new CampaignStatusService({ campaignService, jobService });

    jobService.pickNext();
    jobService.markCompleted(jobs[0].id, 'yt-1');
    campaignService.updateTargetStatus(campaign.id, t1.id, 'publicado', { youtubeVideoId: 'yt-1' });

    const result = statusService.getStatus(campaign.id);
    expect(result!.progress).toMatchObject({
      completed: 1,
      failed: 0,
      total: 2,
    });
  });
});
