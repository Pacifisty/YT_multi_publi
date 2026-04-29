import { describe, expect, test, vi } from 'vitest';

import { AuditEventService, InMemoryAuditEventRepository } from '../../apps/api/src/campaigns/audit-event.service';
import { CampaignService } from '../../apps/api/src/campaigns/campaign.service';
import { CampaignStatusService } from '../../apps/api/src/campaigns/campaign-status.service';
import { JobRunner } from '../../apps/api/src/campaigns/job-runner';
import { LaunchService } from '../../apps/api/src/campaigns/launch.service';
import { PlatformDispatchWorker } from '../../apps/api/src/campaigns/platform-dispatch.worker';
import { PublishJobService } from '../../apps/api/src/campaigns/publish-job.service';
import { TikTokUploadWorker, type TikTokPublishContext } from '../../apps/api/src/campaigns/tiktok-upload.worker';
import { YouTubeUploadWorker, type YouTubeUploadFn } from '../../apps/api/src/campaigns/youtube-upload.worker';
import { MockTikTokApiClient } from '../../apps/api/src/integrations/tiktok/tiktok.mock-adapter';

function createMixedPublishStack() {
  const campaignService = new CampaignService();
  const jobService = new PublishJobService();
  const launchService = new LaunchService({ campaignService, jobService });
  const statusService = new CampaignStatusService({ campaignService, jobService });
  const auditService = new AuditEventService({ repository: new InMemoryAuditEventRepository() });
  const tiktokClient = new MockTikTokApiClient({ pollingAttemptsBeforeSuccess: 0 });

  const uploadFn: YouTubeUploadFn = vi.fn(async (context) => ({
    videoId: `yt-${context.title.replace(/\s+/g, '-').toLowerCase()}`,
  }));

  const youtubeWorker = new YouTubeUploadWorker({
    jobService,
    campaignService,
    auditService,
    uploadFn,
    getAccessToken: vi.fn(async () => 'youtube-access-token'),
    getVideoFilePath: vi.fn(async () => '/tmp/mixed-video.mp4'),
  });

  const tiktokWorker = new TikTokUploadWorker({
    jobService,
    campaignService,
    auditService,
    getAccessToken: vi.fn(async () => 'tiktok-access-token'),
    getPublicVideoUrl: vi.fn(async () => 'https://media.example.com/mixed-video.mp4'),
    queryCreatorInfoFn: vi.fn((accessToken) => tiktokClient.queryCreatorInfo(accessToken)),
    publishFn: vi.fn(async (context: TikTokPublishContext) => {
      const response = await tiktokClient.initPublish(context.accessToken, {
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
      const status = await tiktokClient.fetchPublishStatus(accessToken, publishId);
      return {
        status: status.status,
        failReason: status.fail_reason ?? null,
        publiclyAvailablePostId: status.publicly_available_post_id ?? null,
      };
    }),
    sleepMs: vi.fn(async () => undefined),
  });

  const dispatcher = new PlatformDispatchWorker({
    jobService,
    campaignService,
    youtubeWorker,
    tiktokWorker,
  });
  const runner = new JobRunner({ worker: dispatcher });

  return {
    campaignService,
    jobService,
    launchService,
    statusService,
    auditService,
    tiktokClient,
    uploadFn,
    runner,
  };
}

describe('E2E: mixed YouTube and TikTok campaign publishing', () => {
  test('creates mixed targets, publishes both platforms, aggregates status, and records audit events', async () => {
    const stack = createMixedPublishStack();
    const { campaign } = await stack.campaignService.createCampaign({
      title: 'Mixed campaign',
      videoAssetId: 'asset-mixed-001',
    });

    const { target: youtubeTarget } = await stack.campaignService.addTarget(campaign.id, {
      platform: 'youtube',
      channelId: 'yt-channel-001',
      videoTitle: 'YouTube Launch',
      videoDescription: 'YouTube description',
      tags: ['launch', 'youtube'],
      privacy: 'public',
    });

    const { target: tiktokTarget } = await stack.campaignService.addTarget(campaign.id, {
      platform: 'tiktok',
      destinationId: 'tt-user-001',
      destinationLabel: 'TikTok Creator',
      connectedAccountId: 'tt-account-001',
      videoTitle: 'TikTok Launch',
      videoDescription: 'TikTok description',
      tags: ['launch', 'tiktok'],
      privacy: 'public',
    });
    Object.assign(tiktokTarget, {
      tiktokPrivacyLevel: 'PUBLIC_TO_EVERYONE',
      tiktokDisableComment: true,
      tiktokDisableDuet: false,
      tiktokDisableStitch: true,
    });

    await stack.campaignService.markReady(campaign.id);
    await stack.launchService.launchCampaign(campaign.id);

    const results = await stack.runner.processAll();
    const final = await stack.campaignService.getCampaign(campaign.id);
    const status = await stack.statusService.getStatus(campaign.id);
    const auditEvents = await stack.auditService.listEventsForCampaign(campaign.id);
    const [tiktokPublish] = stack.tiktokClient.getPublishRecords();

    expect(results).toHaveLength(2);
    expect(results.every((result) => result.status === 'completed')).toBe(true);
    expect(stack.uploadFn).toHaveBeenCalledOnce();
    expect(stack.tiktokClient.getPublishAttempts()).toBe(1);

    expect(final?.campaign.status).toBe('completed');
    expect(final?.campaign.targets.find((target) => target.id === youtubeTarget.id)).toMatchObject({
      platform: 'youtube',
      status: 'publicado',
      youtubeVideoId: 'yt-youtube-launch',
      externalPublishId: 'yt-youtube-launch',
    });
    expect(final?.campaign.targets.find((target) => target.id === tiktokTarget.id)).toMatchObject({
      platform: 'tiktok',
      status: 'publicado',
      youtubeVideoId: null,
      externalPublishId: expect.stringMatching(/^post-mock-tt-/),
    });

    expect(status).toMatchObject({
      campaignStatus: 'completed',
      shouldPoll: false,
      progress: {
        completed: 2,
        failed: 0,
        total: 2,
      },
    });
    expect(status?.targets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          platform: 'youtube',
          targetId: youtubeTarget.id,
          youtubeVideoId: 'yt-youtube-launch',
        }),
        expect.objectContaining({
          platform: 'tiktok',
          targetId: tiktokTarget.id,
          connectedAccountId: 'tt-account-001',
          externalPublishId: expect.stringMatching(/^post-mock-tt-/),
        }),
      ]),
    );

    expect(tiktokPublish.params).toMatchObject({
      source: 'PULL_FROM_URL',
      media_source_url: 'https://media.example.com/mixed-video.mp4',
      post_info: {
        privacy_level: 'PUBLIC_TO_EVERYONE',
        disable_comment: true,
        disable_duet: false,
        disable_stitch: true,
      },
    });
    expect(auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: 'publish_completed',
          targetId: youtubeTarget.id,
        }),
        expect.objectContaining({
          eventType: 'publish_completed',
          targetId: tiktokTarget.id,
        }),
      ]),
    );
  });
});
