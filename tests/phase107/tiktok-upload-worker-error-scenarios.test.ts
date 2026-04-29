import { describe, expect, test, vi } from 'vitest';

import { CampaignService, type CampaignTargetRecord } from '../../apps/api/src/campaigns/campaign.service';
import { LaunchService } from '../../apps/api/src/campaigns/launch.service';
import { PublishJobService } from '../../apps/api/src/campaigns/publish-job.service';
import {
  TikTokUploadWorker,
  type TikTokFetchStatusFn,
  type TikTokPublishContext,
  type TikTokPublishFn,
} from '../../apps/api/src/campaigns/tiktok-upload.worker';
import { MockTikTokApiClient } from '../../apps/api/src/integrations/tiktok/tiktok.mock-adapter';

async function setupTikTokJob(targetOverrides: Partial<CampaignTargetRecord> = {}) {
  const campaignService = new CampaignService();
  const jobService = new PublishJobService();
  const launchService = new LaunchService({ campaignService, jobService });

  const { campaign } = await campaignService.createCampaign({
    title: 'TikTok error scenario campaign',
    videoAssetId: 'video-tt-error-scenario',
  });

  const { target } = await campaignService.addTarget(campaign.id, {
    platform: 'tiktok',
    destinationId: 'tt-error-destination',
    destinationLabel: 'TikTok Creator',
    connectedAccountId: 'connected-tiktok-error',
    videoTitle: 'Launch clip',
    videoDescription: 'Description for TikTok',
    tags: ['launch'],
    privacy: 'public',
  });
  Object.assign(target, targetOverrides);

  await campaignService.markReady(campaign.id);
  await launchService.launchCampaign(campaign.id);
  const [job] = await jobService.getJobsForTarget(target.id);

  if (!job) {
    throw new Error('Expected TikTok publish job to be enqueued');
  }

  return { campaignService, jobService, campaign, target, job };
}

function createWorker(
  services: {
    campaignService: CampaignService;
    jobService: PublishJobService;
  },
  options: {
    client?: MockTikTokApiClient;
    accessToken?: string;
    videoUrl?: string;
    publishFn?: TikTokPublishFn;
    fetchStatusFn?: TikTokFetchStatusFn;
  } = {},
) {
  const client = options.client ?? new MockTikTokApiClient({ pollingAttemptsBeforeSuccess: 0 });
  const sleepMs = vi.fn(async () => undefined);
  const publishFn = vi.fn(async (context: TikTokPublishContext) => {
    if (options.publishFn) {
      return options.publishFn(context);
    }

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
  });
  const fetchStatusFn = vi.fn(async (accessToken: string, publishId: string) => {
    if (options.fetchStatusFn) {
      return options.fetchStatusFn(accessToken, publishId);
    }

    const status = await client.fetchPublishStatus(accessToken, publishId);
    return {
      status: status.status,
      failReason: status.fail_reason ?? null,
      publiclyAvailablePostId: status.publicly_available_post_id ?? null,
    };
  });

  return {
    client,
    publishFn,
    fetchStatusFn,
    sleepMs,
    worker: new TikTokUploadWorker({
      ...services,
      getAccessToken: vi.fn(async () => options.accessToken ?? 'valid-token'),
      getPublicVideoUrl: vi.fn(async () => options.videoUrl ?? 'https://media.example.com/video.mp4'),
      queryCreatorInfoFn: vi.fn((accessToken) => client.queryCreatorInfo(accessToken)),
      publishFn,
      fetchStatusFn,
      sleepMs,
    }),
  };
}

async function getUpdatedTarget(campaignService: CampaignService, campaignId: string, targetId: string) {
  const updated = await campaignService.getCampaign(campaignId);
  const target = updated?.campaign.targets.find((entry) => entry.id === targetId);

  if (!updated || !target) {
    throw new Error('Expected updated campaign target');
  }

  return { campaign: updated.campaign, target };
}

describe('TikTokUploadWorker error scenarios with mock adapter', () => {
  test('marks expired TikTok token code 10002 as transient', async () => {
    const setup = await setupTikTokJob();
    const expiredTokenError = Object.assign(new Error('TikTok access token expired'), {
      errorCode: '10002',
    });
    const { worker } = createWorker(setup, {
      publishFn: vi.fn(async () => {
        throw expiredTokenError;
      }),
    });

    const result = await worker.processPickedJob(setup.job, setup.target, setup.campaign.videoAssetId);
    const updated = await getUpdatedTarget(setup.campaignService, setup.campaign.id, setup.target.id);

    expect(result?.status).toBe('failed');
    expect(result?.errorClass).toBe('transient');
    expect(updated.target.status).toBe('erro');
    expect(updated.target.errorMessage).toBe('TikTok access token expired');
    expect(updated.campaign.status).toBe('failed');
  });

  test('marks revoked TikTok refresh token as permanent before publishing', async () => {
    const setup = await setupTikTokJob();
    const { worker, publishFn } = createWorker(setup, {
      accessToken: 'revoked_token',
    });

    const result = await worker.processPickedJob(setup.job, setup.target, setup.campaign.videoAssetId);
    const updated = await getUpdatedTarget(setup.campaignService, setup.campaign.id, setup.target.id);

    expect(result?.status).toBe('failed');
    expect(result?.errorClass).toBe('permanent');
    expect(result?.errorMessage).toBe('TikTok refresh token was revoked');
    expect(updated.target.status).toBe('erro');
    expect(updated.target.errorMessage).toBe('TikTok refresh token was revoked');
    expect(publishFn).not.toHaveBeenCalled();
  });

  test('marks TikTok content policy and copyright rejection as permanent', async () => {
    const setup = await setupTikTokJob();
    const { worker } = createWorker(setup, {
      client: new MockTikTokApiClient({
        publishFailureReason: 'Content Policy Violation: copyright claim',
        pollingAttemptsBeforeSuccess: 0,
      }),
    });

    const result = await worker.processPickedJob(setup.job, setup.target, setup.campaign.videoAssetId);
    const updated = await getUpdatedTarget(setup.campaignService, setup.campaign.id, setup.target.id);

    expect(result?.status).toBe('failed');
    expect(result?.errorClass).toBe('permanent');
    expect(result?.errorMessage).toBe('Content Policy Violation: copyright claim');
    expect(updated.target.status).toBe('erro');
    expect(updated.target.errorMessage).toBe('Content Policy Violation: copyright claim');
  });

  test('marks inaccessible TikTok media URL rejection as transient', async () => {
    const setup = await setupTikTokJob();
    const { worker } = createWorker(setup, {
      client: new MockTikTokApiClient({
        publishFailureReason: 'Media URL not accessible',
        pollingAttemptsBeforeSuccess: 0,
      }),
    });

    const result = await worker.processPickedJob(setup.job, setup.target, setup.campaign.videoAssetId);
    const updated = await getUpdatedTarget(setup.campaignService, setup.campaign.id, setup.target.id);

    expect(result?.status).toBe('failed');
    expect(result?.errorClass).toBe('transient');
    expect(updated.target.status).toBe('erro');
    expect(updated.target.errorMessage).toBe('Media URL not accessible');
  });

  test('marks network timeout while fetching TikTok status as transient', async () => {
    const setup = await setupTikTokJob();
    const { worker, fetchStatusFn } = createWorker(setup, {
      fetchStatusFn: vi.fn(async () => {
        throw Object.assign(new Error('ECONNREFUSED while fetching TikTok status'), {
          code: 'ECONNREFUSED',
        });
      }),
    });

    const result = await worker.processPickedJob(setup.job, setup.target, setup.campaign.videoAssetId);
    const updated = await getUpdatedTarget(setup.campaignService, setup.campaign.id, setup.target.id);

    expect(fetchStatusFn).toHaveBeenCalledOnce();
    expect(result?.status).toBe('failed');
    expect(result?.errorClass).toBe('transient');
    expect(updated.target.errorMessage).toBe('ECONNREFUSED while fetching TikTok status');
  });

  test('backs off and retries mock TikTok 429 publish initialization', async () => {
    const setup = await setupTikTokJob();
    const { worker, client, sleepMs } = createWorker(setup, {
      client: new MockTikTokApiClient({
        rateLimitForAttempts: 2,
        pollingAttemptsBeforeSuccess: 0,
      }),
    });

    const result = await worker.processPickedJob(setup.job, setup.target, setup.campaign.videoAssetId);
    const updated = await getUpdatedTarget(setup.campaignService, setup.campaign.id, setup.target.id);

    expect(result?.status).toBe('completed');
    expect(client.getPublishAttempts()).toBe(3);
    expect(sleepMs).toHaveBeenNthCalledWith(1, 1000);
    expect(sleepMs).toHaveBeenNthCalledWith(2, 2000);
    expect(updated.target.status).toBe('publicado');
  });

  test('falls back to SELF_ONLY when TikTok creator privacy options are empty', async () => {
    const setup = await setupTikTokJob({
      privacy: 'PUBLIC_TO_EVERYONE',
      tiktokPrivacyLevel: 'PUBLIC_TO_EVERYONE',
    });
    const { worker, client } = createWorker(setup, {
      client: new MockTikTokApiClient({
        privacyLevelOptions: [],
        pollingAttemptsBeforeSuccess: 0,
      }),
    });

    const result = await worker.processPickedJob(setup.job, setup.target, setup.campaign.videoAssetId);
    const [record] = client.getPublishRecords();
    const updated = await getUpdatedTarget(setup.campaignService, setup.campaign.id, setup.target.id);

    expect(result?.status).toBe('completed');
    expect(record.params.post_info.privacy_level).toBe('SELF_ONLY');
    expect(updated.target.status).toBe('publicado');
  });

  test('truncates long TikTok titles before direct post initialization', async () => {
    const setup = await setupTikTokJob({
      videoTitle: 'a'.repeat(2500),
      videoDescription: 'b'.repeat(100),
      tags: ['launch', 'oversized'],
    });
    const { worker, client } = createWorker(setup);

    const result = await worker.processPickedJob(setup.job, setup.target, setup.campaign.videoAssetId);
    const [record] = client.getPublishRecords();

    expect(result?.status).toBe('completed');
    expect(record.params.post_info.title).toHaveLength(2200);
    expect(record.params.post_info.title).toBe('a'.repeat(2200));
  });
});
