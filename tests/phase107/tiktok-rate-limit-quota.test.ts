import { describe, expect, test, vi } from 'vitest';

import { CampaignService } from '../../apps/api/src/campaigns/campaign.service';
import { LaunchService } from '../../apps/api/src/campaigns/launch.service';
import { PublishJobService } from '../../apps/api/src/campaigns/publish-job.service';
import { TikTokUploadWorker, type TikTokPublishContext } from '../../apps/api/src/campaigns/tiktok-upload.worker';
import { MockTikTokApiClient } from '../../apps/api/src/integrations/tiktok/tiktok.mock-adapter';
import { InMemoryTikTokPublishQuotaTracker } from '../../apps/api/src/integrations/tiktok/tiktok-publish-quota';

async function setupTikTokQuotaJob() {
  const campaignService = new CampaignService();
  const jobService = new PublishJobService();
  const launchService = new LaunchService({ campaignService, jobService });
  const { campaign } = await campaignService.createCampaign({
    title: 'TikTok quota campaign',
    videoAssetId: 'quota-video',
  });
  const { target } = await campaignService.addTarget(campaign.id, {
    platform: 'tiktok',
    destinationId: 'tt-quota-destination',
    destinationLabel: 'TikTok Quota Account',
    connectedAccountId: 'tt-quota-account',
    videoTitle: 'Quota Clip',
    videoDescription: 'Quota test',
    tags: ['quota'],
    privacy: 'public',
  });

  await campaignService.markReady(campaign.id);
  await launchService.launchCampaign(campaign.id);
  const [job] = await jobService.getJobsForTarget(target.id);

  if (!job) {
    throw new Error('Expected TikTok quota job');
  }

  return { campaignService, jobService, campaign, target, job };
}

function createQuotaWorker(
  services: {
    campaignService: CampaignService;
    jobService: PublishJobService;
  },
  quotaTracker: InMemoryTikTokPublishQuotaTracker,
) {
  const client = new MockTikTokApiClient({ pollingAttemptsBeforeSuccess: 0 });

  return {
    client,
    worker: new TikTokUploadWorker({
      ...services,
      quotaTracker,
      getAccessToken: vi.fn(async () => 'valid-token'),
      getPublicVideoUrl: vi.fn(async () => 'https://media.example.com/quota-video.mp4'),
      queryCreatorInfoFn: vi.fn((accessToken) => client.queryCreatorInfo(accessToken)),
      publishFn: vi.fn(async (context: TikTokPublishContext) => {
        const response = await client.initPublish(context.accessToken, {
          source: 'PULL_FROM_URL',
          media_source_url: context.videoUrl,
          post_info: {
            title: context.title,
            privacy_level: context.privacy,
            disable_comment: context.disableComment,
            disable_duet: context.disableDuet,
            disable_stitch: context.disableStitch,
          },
        });
        return { publishId: response.publish_id };
      }),
      fetchStatusFn: vi.fn(async (accessToken, publishId) => {
        const status = await client.fetchPublishStatus(accessToken, publishId);
        return {
          status: status.status,
          failReason: status.fail_reason ?? null,
          publiclyAvailablePostId: status.publicly_available_post_id ?? null,
        };
      }),
      sleepMs: vi.fn(async () => undefined),
    }),
  };
}

describe('TikTok publish rate limit and daily quota tracking', () => {
  test('enforces six publishes per rolling minute and opens after the window passes', () => {
    let nowMs = Date.parse('2026-04-28T10:00:00.000Z');
    const tracker = new InMemoryTikTokPublishQuotaTracker({
      now: () => new Date(nowMs),
    });

    for (let i = 0; i < 6; i += 1) {
      expect(tracker.canPublish('tt-account-a').allowed).toBe(true);
      tracker.recordPublish('tt-account-a');
    }

    expect(tracker.canPublish('tt-account-a')).toMatchObject({
      allowed: false,
      limit: 'minute',
    });

    nowMs += 60_000;

    expect(tracker.canPublish('tt-account-a').allowed).toBe(true);
    expect(tracker.getUsage('tt-account-a')).toEqual({ minute: 0, day: 6 });
  });

  test('enforces fifteen publishes per UTC day per account and resets the next day', () => {
    let nowMs = Date.parse('2026-04-28T10:00:00.000Z');
    const tracker = new InMemoryTikTokPublishQuotaTracker({
      now: () => new Date(nowMs),
    });

    for (let i = 0; i < 15; i += 1) {
      tracker.recordPublish('tt-account-a');
    }

    expect(tracker.canPublish('tt-account-a')).toMatchObject({
      allowed: false,
      limit: 'day',
      retryAfter: new Date('2026-04-29T00:00:00.000Z'),
    });
    expect(tracker.canPublish('tt-account-b').allowed).toBe(true);

    nowMs = Date.parse('2026-04-29T00:00:00.000Z');

    expect(tracker.canPublish('tt-account-a').allowed).toBe(true);
    expect(tracker.getUsage('tt-account-a')).toEqual({ minute: 0, day: 0 });
  });

  test('skips TikTok worker publishing when quota is reached and leaves target waiting', async () => {
    const setup = await setupTikTokQuotaJob();
    const quotaTracker = new InMemoryTikTokPublishQuotaTracker({
      maxPerDay: 1,
      now: () => new Date('2026-04-28T10:00:00.000Z'),
    });
    quotaTracker.recordPublish('tt-quota-account');
    const { worker, client } = createQuotaWorker(setup, quotaTracker);

    const result = await worker.processPickedJob(setup.job, setup.target, setup.campaign.videoAssetId);
    const updated = await setup.campaignService.getCampaign(setup.campaign.id);
    const target = updated?.campaign.targets.find((entry) => entry.id === setup.target.id);

    expect(result?.status).toBe('failed');
    expect(result?.errorClass).toBe('transient');
    expect(result?.errorMessage).toContain('TikTok daily publish quota reached');
    expect(client.getPublishAttempts()).toBe(0);
    expect(target).toMatchObject({
      status: 'aguardando',
      errorMessage: null,
      externalPublishId: null,
    });
    expect(updated?.campaign.status).toBe('launching');
  });

  test('records successful TikTok publishes against the quota tracker', async () => {
    const setup = await setupTikTokQuotaJob();
    const quotaTracker = new InMemoryTikTokPublishQuotaTracker({
      now: () => new Date('2026-04-28T10:00:00.000Z'),
    });
    const { worker } = createQuotaWorker(setup, quotaTracker);

    const result = await worker.processPickedJob(setup.job, setup.target, setup.campaign.videoAssetId);

    expect(result?.status).toBe('completed');
    expect(quotaTracker.getUsage('tt-quota-account')).toEqual({
      minute: 1,
      day: 1,
    });
  });
});
