import { mkdtemp, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test, vi } from 'vitest';

import { CampaignService } from '../../apps/api/src/campaigns/campaign.service';
import { LaunchService } from '../../apps/api/src/campaigns/launch.service';
import { PlatformDispatchWorker } from '../../apps/api/src/campaigns/platform-dispatch.worker';
import { PublishJobService } from '../../apps/api/src/campaigns/publish-job.service';
import { TikTokUploadWorker } from '../../apps/api/src/campaigns/tiktok-upload.worker';
import { createRequestHandler } from '../../apps/api/src/http-adapter';
import type { AppInstance } from '../../apps/api/src/app';
import { PublicMediaUrlService } from '../../apps/api/src/media/public-media-url.service';

function mockReq(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  const req: any = {
    method: 'GET',
    url: '/',
    headers: {},
    on(_event: string, _cb: Function) {
      return req;
    },
    ...overrides,
  };
  return req as IncomingMessage;
}

function mockRes(): ServerResponse & { _status: number; _headers: Record<string, string | string[]>; _body: string | Buffer } {
  const res: any = {
    _status: 0,
    _headers: {} as Record<string, string | string[]>,
    _body: '',
    writeHead(status: number, headers?: Record<string, string | string[]>) {
      res._status = status;
      if (headers) Object.assign(res._headers, headers);
      return res;
    },
    setHeader(name: string, value: string | string[]) {
      res._headers[name.toLowerCase()] = value;
      return res;
    },
    end(body?: string | Buffer) {
      if (body !== undefined) res._body = body;
    },
  };
  return res;
}

describe('campaign multi-platform targets', () => {
  test('rejects duplicate targets per platform and destination id', async () => {
    const service = new CampaignService();
    const { campaign } = await service.createCampaign({
      title: 'Multi-platform campaign',
      videoAssetId: 'video-2',
    });

    await service.addTarget(campaign.id, {
      platform: 'tiktok',
      destinationId: 'tt-account-1',
      destinationLabel: 'TikTok Brand',
      connectedAccountId: 'tt-account-1',
      videoTitle: 'TikTok title',
      videoDescription: 'TikTok description',
    });

    await expect(
      service.addTarget(campaign.id, {
        platform: 'tiktok',
        destinationId: 'tt-account-1',
        destinationLabel: 'TikTok Brand',
        connectedAccountId: 'tt-account-1',
        videoTitle: 'TikTok title 2',
        videoDescription: 'TikTok description 2',
      }),
    ).rejects.toThrow('Target for this channel already exists in the campaign');
  });

});

describe('platform dispatch worker', () => {
  test('routes tiktok jobs to the tiktok worker and completes the campaign', async () => {
    const campaignService = new CampaignService();
    const jobService = new PublishJobService();
    const launchService = new LaunchService({ campaignService, jobService });

    const { campaign } = await campaignService.createCampaign({
      title: 'TikTok publish',
      videoAssetId: 'video-tt-1',
    });

    const { target } = await campaignService.addTarget(campaign.id, {
      platform: 'tiktok',
      destinationId: 'tt-user-123',
      destinationLabel: 'Brand TikTok',
      connectedAccountId: 'connected-tiktok-1',
      videoTitle: 'Launch short',
      videoDescription: 'TikTok description',
    });

    await campaignService.markReady(campaign.id);
    await launchService.launchCampaign(campaign.id);

    const youtubeWorker = { processPickedJob: vi.fn() } as any;
    const tiktokWorker = {
      processPickedJob: vi.fn(async (job, passedTarget) => {
        await jobService.markCompleted(job.id, 'tt-post-123');
        await campaignService.updateTargetStatus(passedTarget.campaignId, passedTarget.id, 'publicado', {
          externalPublishId: 'tt-post-123',
        });
        return (await jobService.getJobsForTarget(passedTarget.id))[0] ?? null;
      }),
    } as any;

    const worker = new PlatformDispatchWorker({
      jobService,
      campaignService,
      youtubeWorker,
      tiktokWorker,
    });

    const job = await worker.processNext();
    const updated = await campaignService.getCampaign(campaign.id);
    const updatedTarget = updated!.campaign.targets.find((entry) => entry.id === target.id);

    expect(job?.status).toBe('completed');
    expect(tiktokWorker.processPickedJob).toHaveBeenCalledOnce();
    expect(youtubeWorker.processPickedJob).not.toHaveBeenCalled();
    expect(updatedTarget).toMatchObject({
      status: 'publicado',
      externalPublishId: 'tt-post-123',
      youtubeVideoId: null,
    });
    expect(updated!.campaign.status).toBe('completed');
  });
});

describe('tiktok upload worker', () => {
  test('publishes via direct post and waits until the post completes', async () => {
    const campaignService = new CampaignService();
    const jobService = new PublishJobService();
    const launchService = new LaunchService({ campaignService, jobService });

    const { campaign } = await campaignService.createCampaign({
      title: 'TikTok worker campaign',
      videoAssetId: 'video-tt-worker-1',
    });

    const { target } = await campaignService.addTarget(campaign.id, {
      platform: 'tiktok',
      destinationId: 'tt-user-789',
      destinationLabel: 'TikTok Creator',
      connectedAccountId: 'connected-tiktok-789',
      videoTitle: 'Launch clip',
      videoDescription: 'Description for TikTok',
      tags: ['launch', 'promo'],
      privacy: 'private',
    });

    await campaignService.markReady(campaign.id);
    await launchService.launchCampaign(campaign.id);
    const [job] = await jobService.getJobsForTarget(target.id);

    const worker = new TikTokUploadWorker({
      jobService,
      campaignService,
      getAccessToken: vi.fn(async () => 'tt-access-token'),
      getPublicVideoUrl: vi.fn(async () => 'https://example.com/video.mp4'),
      queryCreatorInfoFn: vi.fn(async () => ({
        privacyLevelOptions: ['SELF_ONLY', 'PUBLIC_TO_EVERYONE'],
        commentDisabled: false,
        duetDisabled: false,
        stitchDisabled: false,
      })),
      publishFn: vi.fn(async (context) => {
        expect(context.privacy).toBe('SELF_ONLY');
        expect(context.title).toContain('#launch');
        return { publishId: 'tt-publish-123' };
      }),
      fetchStatusFn: vi
        .fn()
        .mockResolvedValueOnce({ status: 'PROCESSING_DOWNLOAD' })
        .mockResolvedValueOnce({ status: 'PUBLISH_COMPLETE', publiclyAvailablePostId: 'tt-post-999' }),
      sleepMs: vi.fn(async () => undefined),
    });

    const result = await worker.processPickedJob(job, target, campaign.videoAssetId);
    const updated = await campaignService.getCampaign(campaign.id);
    const updatedTarget = updated!.campaign.targets.find((entry) => entry.id === target.id);

    expect(result?.status).toBe('completed');
    expect(updatedTarget).toMatchObject({
      status: 'publicado',
      externalPublishId: 'tt-post-999',
      youtubeVideoId: null,
    });
    expect(updated!.campaign.status).toBe('completed');
  });

  test('fails the target when TikTok returns a failed publishing status', async () => {
    const campaignService = new CampaignService();
    const jobService = new PublishJobService();
    const launchService = new LaunchService({ campaignService, jobService });

    const { campaign } = await campaignService.createCampaign({
      title: 'TikTok failed campaign',
      videoAssetId: 'video-tt-worker-2',
    });

    const { target } = await campaignService.addTarget(campaign.id, {
      platform: 'tiktok',
      destinationId: 'tt-user-987',
      destinationLabel: 'TikTok Creator',
      connectedAccountId: 'connected-tiktok-987',
      videoTitle: 'Launch clip',
      videoDescription: 'Description for TikTok',
    });

    await campaignService.markReady(campaign.id);
    await launchService.launchCampaign(campaign.id);
    const [job] = await jobService.getJobsForTarget(target.id);

    const worker = new TikTokUploadWorker({
      jobService,
      campaignService,
      getAccessToken: vi.fn(async () => 'tt-access-token'),
      getPublicVideoUrl: vi.fn(async () => 'https://example.com/video.mp4'),
      queryCreatorInfoFn: vi.fn(async () => ({
        privacyLevelOptions: ['SELF_ONLY'],
        commentDisabled: false,
        duetDisabled: false,
        stitchDisabled: false,
      })),
      publishFn: vi.fn(async () => ({ publishId: 'tt-publish-987' })),
      fetchStatusFn: vi.fn(async () => ({ status: 'FAILED', failReason: 'duration_check_failed' })),
      sleepMs: vi.fn(async () => undefined),
    });

    const result = await worker.processPickedJob(job, target, campaign.videoAssetId);
    const updated = await campaignService.getCampaign(campaign.id);
    const updatedTarget = updated!.campaign.targets.find((entry) => entry.id === target.id);

    expect(result?.status).toBe('failed');
    expect(result?.errorMessage).toBe('duration_check_failed');
    expect(updatedTarget?.status).toBe('erro');
    expect(updatedTarget?.errorMessage).toBe('duration_check_failed');
    expect(updated!.campaign.status).toBe('failed');
  });

  test('treats long TikTok processing as accepted and stores the publish id', async () => {
    const campaignService = new CampaignService();
    const jobService = new PublishJobService();
    const launchService = new LaunchService({ campaignService, jobService });

    const { campaign } = await campaignService.createCampaign({
      title: 'TikTok pending campaign',
      videoAssetId: 'video-tt-worker-3',
    });

    const { target } = await campaignService.addTarget(campaign.id, {
      platform: 'tiktok',
      destinationId: 'tt-user-654',
      destinationLabel: 'TikTok Creator',
      connectedAccountId: 'connected-tiktok-654',
      videoTitle: 'Launch clip',
      videoDescription: 'Description for TikTok',
    });

    await campaignService.markReady(campaign.id);
    await launchService.launchCampaign(campaign.id);
    const [job] = await jobService.getJobsForTarget(target.id);

    const worker = new TikTokUploadWorker({
      jobService,
      campaignService,
      getAccessToken: vi.fn(async () => 'tt-access-token'),
      getPublicVideoUrl: vi.fn(async () => 'https://example.com/video.mp4'),
      queryCreatorInfoFn: vi.fn(async () => ({
        privacyLevelOptions: ['SELF_ONLY'],
        commentDisabled: false,
        duetDisabled: false,
        stitchDisabled: false,
      })),
      publishFn: vi.fn(async () => ({ publishId: 'tt-publish-pending' })),
      fetchStatusFn: vi.fn(async () => ({ status: 'PROCESSING_DOWNLOAD' })),
      sleepMs: vi.fn(async () => undefined),
    });

    const result = await worker.processPickedJob(job, target, campaign.videoAssetId);
    const updated = await campaignService.getCampaign(campaign.id);
    const updatedTarget = updated!.campaign.targets.find((entry) => entry.id === target.id);

    expect(result?.status).toBe('completed');
    expect(updatedTarget).toMatchObject({
      status: 'publicado',
      externalPublishId: 'tt-publish-pending',
      youtubeVideoId: null,
    });
    expect(updated!.campaign.status).toBe('completed');
  });

  test('uses stored TikTok privacy and moderation flags when publishing', async () => {
    const campaignService = new CampaignService();
    const jobService = new PublishJobService();
    const launchService = new LaunchService({ campaignService, jobService });

    const { campaign } = await campaignService.createCampaign({
      title: 'TikTok settings campaign',
      videoAssetId: 'video-tt-worker-4',
    });

    const { target } = await campaignService.addTarget(campaign.id, {
      platform: 'tiktok',
      destinationId: 'tt-user-settings',
      destinationLabel: 'TikTok Creator',
      connectedAccountId: 'connected-tiktok-settings',
      videoTitle: 'Launch clip',
      videoDescription: 'Description for TikTok',
      privacy: 'private',
    });
    target.tiktokPrivacyLevel = 'PUBLIC_TO_EVERYONE';
    target.tiktokDisableComment = true;
    target.tiktokDisableDuet = true;
    target.tiktokDisableStitch = false;

    await campaignService.markReady(campaign.id);
    await launchService.launchCampaign(campaign.id);
    const [job] = await jobService.getJobsForTarget(target.id);

    const publishFn = vi.fn(async () => ({ publishId: 'tt-publish-settings' }));
    const worker = new TikTokUploadWorker({
      jobService,
      campaignService,
      getAccessToken: vi.fn(async () => 'tt-access-token'),
      getPublicVideoUrl: vi.fn(async () => 'https://example.com/video.mp4'),
      queryCreatorInfoFn: vi.fn(async () => ({
        privacyLevelOptions: ['SELF_ONLY', 'PUBLIC_TO_EVERYONE'],
      })),
      publishFn,
      fetchStatusFn: vi.fn(async () => ({
        status: 'PUBLISH_COMPLETE',
        publiclyAvailablePostId: 'tt-post-settings',
      })),
      sleepMs: vi.fn(async () => undefined),
    });

    await worker.processPickedJob(job, target, campaign.videoAssetId);

    expect(publishFn).toHaveBeenCalledWith(
      expect.objectContaining({
        privacy: 'PUBLIC_TO_EVERYONE',
        disableComment: true,
        disableDuet: true,
        disableStitch: false,
      }),
    );
  });

  test('backs off and retries when TikTok rate limits publish initialization', async () => {
    const campaignService = new CampaignService();
    const jobService = new PublishJobService();
    const launchService = new LaunchService({ campaignService, jobService });

    const { campaign } = await campaignService.createCampaign({
      title: 'TikTok rate limited campaign',
      videoAssetId: 'video-tt-worker-5',
    });

    const { target } = await campaignService.addTarget(campaign.id, {
      platform: 'tiktok',
      destinationId: 'tt-user-rate-limit',
      destinationLabel: 'TikTok Creator',
      connectedAccountId: 'connected-tiktok-rate-limit',
      videoTitle: 'Launch clip',
      videoDescription: 'Description for TikTok',
    });

    await campaignService.markReady(campaign.id);
    await launchService.launchCampaign(campaign.id);
    const [job] = await jobService.getJobsForTarget(target.id);

    const rateLimitError = Object.assign(new Error('Too many requests'), {
      statusCode: 429,
      errorCode: 'rate_limit_exceeded',
    });
    const publishFn = vi
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce({ publishId: 'tt-publish-after-backoff' });
    const sleepMs = vi.fn(async () => undefined);

    const worker = new TikTokUploadWorker({
      jobService,
      campaignService,
      getAccessToken: vi.fn(async () => 'tt-access-token'),
      getPublicVideoUrl: vi.fn(async () => 'https://example.com/video.mp4'),
      queryCreatorInfoFn: vi.fn(async () => ({
        privacyLevelOptions: ['SELF_ONLY'],
      })),
      publishFn,
      fetchStatusFn: vi.fn(async () => ({
        status: 'PUBLISH_COMPLETE',
        publiclyAvailablePostId: 'tt-post-after-backoff',
      })),
      sleepMs,
    });

    const result = await worker.processPickedJob(job, target, campaign.videoAssetId);

    expect(result?.status).toBe('completed');
    expect(publishFn).toHaveBeenCalledTimes(2);
    expect(sleepMs).toHaveBeenCalledWith(1000);
  });
});

describe('public media route', () => {
  test('serves media files with a valid signed URL', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'ytmp-public-media-'));
    const filePath = join(tempDir, 'clip.mp4');
    const fileContents = Buffer.from('public-video-bytes');
    await writeFile(filePath, fileContents);

    const publicMediaUrlService = new PublicMediaUrlService({
      baseUrl: 'http://127.0.0.1:3000',
      secret: '12345678901234567890123456789012',
    });

    const url = new URL(publicMediaUrlService.createUrl('media-public-1'));
    const app: AppInstance = {
      handleRequest: vi.fn(),
      authModule: {} as any,
      campaignsModule: {} as any,
      accountsModule: {} as any,
      mediaModule: {
        mediaService: {
          getAssetFile: vi.fn(async () => ({
            asset: {
              id: 'media-public-1',
              mime_type: 'video/mp4',
            },
            absolute_path: filePath,
          })),
        },
      } as any,
      router: {} as any,
      backgroundProcessor: null,
      publicMediaUrlService,
    };

    const handler = createRequestHandler({ app });
    const req = mockReq({ method: 'GET', url: `${url.pathname}${url.search}` });
    const res = mockRes();

    await handler(req, res as any);

    expect(app.mediaModule.mediaService.getAssetFile).toHaveBeenCalledWith('media-public-1');
    expect(res._status).toBe(200);
    expect(res._headers['content-type']).toBe('video/mp4');
    expect(res._body).toEqual(fileContents);
  });

  test('rejects public media requests with invalid signatures', async () => {
    const app: AppInstance = {
      handleRequest: vi.fn(),
      authModule: {} as any,
      campaignsModule: {} as any,
      accountsModule: {} as any,
      mediaModule: {
        mediaService: {
          getAssetFile: vi.fn(),
        },
      } as any,
      router: {} as any,
      backgroundProcessor: null,
      publicMediaUrlService: new PublicMediaUrlService({
        baseUrl: 'http://127.0.0.1:3000',
        secret: '12345678901234567890123456789012',
      }),
    };

    const handler = createRequestHandler({ app });
    const req = mockReq({
      method: 'GET',
      url: '/public-media/media-public-1?expires=9999999999&signature=invalid',
    });
    const res = mockRes();

    await handler(req, res as any);

    expect(res._status).toBe(403);
    expect(res._body).toBe('Invalid or expired media signature.');
    expect(app.mediaModule.mediaService.getAssetFile).not.toHaveBeenCalled();
  });
});
