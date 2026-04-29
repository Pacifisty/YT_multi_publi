import { describe, expect, test, vi } from 'vitest';

import { AuditEventService, InMemoryAuditEventRepository } from '../../apps/api/src/campaigns/audit-event.service';
import { CampaignService } from '../../apps/api/src/campaigns/campaign.service';
import { CampaignStatusService } from '../../apps/api/src/campaigns/campaign-status.service';
import { InstagramUploadWorker, type InstagramPublishContext } from '../../apps/api/src/campaigns/instagram-upload.worker';
import { JobRunner } from '../../apps/api/src/campaigns/job-runner';
import { LaunchService } from '../../apps/api/src/campaigns/launch.service';
import { PlatformDispatchWorker } from '../../apps/api/src/campaigns/platform-dispatch.worker';
import { PublishJobService } from '../../apps/api/src/campaigns/publish-job.service';
import { TikTokUploadWorker, type TikTokPublishContext } from '../../apps/api/src/campaigns/tiktok-upload.worker';
import { YouTubeUploadWorker, type YouTubeUploadFn } from '../../apps/api/src/campaigns/youtube-upload.worker';
import { MockInstagramApiClient } from '../../apps/api/src/integrations/instagram/instagram.mock-adapter';
import { MockTikTokApiClient } from '../../apps/api/src/integrations/tiktok/tiktok.mock-adapter';

function createThreePlatformPublishStack() {
  const campaignService = new CampaignService();
  const jobService = new PublishJobService();
  const launchService = new LaunchService({ campaignService, jobService });
  const statusService = new CampaignStatusService({ campaignService, jobService });
  const auditService = new AuditEventService({ repository: new InMemoryAuditEventRepository() });
  const tiktokClient = new MockTikTokApiClient({ pollingAttemptsBeforeSuccess: 0 });
  const instagramClient = new MockInstagramApiClient({ pollingAttemptsBeforeSuccess: 0 });

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

  const instagramWorker = new InstagramUploadWorker({
    jobService,
    campaignService,
    auditService,
    getAccessToken: vi.fn(async () => 'instagram-access-token'),
    getPublicVideoUrl: vi.fn(async () => 'https://media.example.com/mixed-video.mp4'),
    getInstagramBusinessAccountId: vi.fn(async () => 'ig-business-001'),
    createContainerFn: vi.fn(async (context: InstagramPublishContext) => {
      const response = await instagramClient.createReelsContainer(context.accessToken, {
        videoUrl: context.videoUrl,
        caption: context.caption,
        shareToFeed: context.shareToFeed,
      });

      return { containerId: response.creation_id };
    }),
    fetchContainerStatusFn: vi.fn(async (accessToken, containerId) => {
      const status = await instagramClient.fetchContainerStatus(accessToken, containerId);
      return {
        status: status.status_code,
        errorMessage: status.error_message ?? null,
      };
    }),
    publishContainerFn: vi.fn(async ({ accessToken, containerId }) => {
      const response = await instagramClient.publishReelsContainer(accessToken, containerId);
      return { postId: response.id };
    }),
    sleepMs: vi.fn(async () => undefined),
  });

  const dispatcher = new PlatformDispatchWorker({
    jobService,
    campaignService,
    youtubeWorker,
    tiktokWorker,
    instagramWorker,
  });
  const runner = new JobRunner({ worker: dispatcher });

  return {
    campaignService,
    launchService,
    statusService,
    auditService,
    instagramClient,
    tiktokClient,
    uploadFn,
    runner,
  };
}

describe('Phase 108 - Instagram worker and mixed publishing', () => {
  test('publishes YouTube, TikTok, and Instagram targets in one campaign', async () => {
    const stack = createThreePlatformPublishStack();
    const { campaign } = await stack.campaignService.createCampaign({
      title: 'Three platform campaign',
      videoAssetId: 'asset-three-platform-001',
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

    const { target: instagramTarget } = await stack.campaignService.addTarget(campaign.id, {
      platform: 'instagram',
      destinationId: 'ig-account-001',
      destinationLabel: 'Instagram Creator',
      connectedAccountId: 'ig-account-001',
      videoTitle: 'Instagram Launch',
      videoDescription: 'Instagram description',
      tags: ['launch', 'instagram'],
      privacy: 'public',
    });
    Object.assign(instagramTarget, {
      instagramCaption: 'Instagram Reel caption',
      instagramShareToFeed: false,
    });

    await stack.campaignService.markReady(campaign.id);
    await stack.launchService.launchCampaign(campaign.id);

    const results = await stack.runner.processAll();
    const final = await stack.campaignService.getCampaign(campaign.id);
    const status = await stack.statusService.getStatus(campaign.id);
    const auditEvents = await stack.auditService.listEventsForCampaign(campaign.id);
    const [instagramContainer] = stack.instagramClient.getContainerRecords();

    expect(results).toHaveLength(3);
    expect(results.every((result) => result.status === 'completed')).toBe(true);
    expect(stack.uploadFn).toHaveBeenCalledOnce();
    expect(stack.tiktokClient.getPublishAttempts()).toBe(1);

    expect(final?.campaign.status).toBe('completed');
    expect(final?.campaign.targets.find((target) => target.id === youtubeTarget.id)).toMatchObject({
      platform: 'youtube',
      status: 'publicado',
      externalPublishId: 'yt-youtube-launch',
    });
    expect(final?.campaign.targets.find((target) => target.id === tiktokTarget.id)).toMatchObject({
      platform: 'tiktok',
      status: 'publicado',
      externalPublishId: expect.stringMatching(/^post-mock-tt-/),
    });
    expect(final?.campaign.targets.find((target) => target.id === instagramTarget.id)).toMatchObject({
      platform: 'instagram',
      status: 'publicado',
      youtubeVideoId: null,
      externalPublishId: expect.stringMatching(/^ig-post-mock-ig-container-/),
    });

    expect(status).toMatchObject({
      campaignStatus: 'completed',
      shouldPoll: false,
      progress: {
        completed: 3,
        failed: 0,
        total: 3,
      },
    });
    expect(instagramContainer.params).toMatchObject({
      videoUrl: 'https://media.example.com/mixed-video.mp4',
      caption: 'Instagram Reel caption',
      shareToFeed: false,
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
        expect.objectContaining({
          eventType: 'publish_completed',
          targetId: instagramTarget.id,
        }),
      ]),
    );
  });

  test('marks Instagram target and job failed when container processing fails', async () => {
    const campaignService = new CampaignService();
    const jobService = new PublishJobService();
    const launchService = new LaunchService({ campaignService, jobService });
    const instagramClient = new MockInstagramApiClient({
      pollingAttemptsBeforeSuccess: 0,
      publishFailureReason: 'Media processing failed',
    });
    const worker = new InstagramUploadWorker({
      jobService,
      campaignService,
      getAccessToken: vi.fn(async () => 'instagram-access-token'),
      getPublicVideoUrl: vi.fn(async () => 'https://media.example.com/fail-video.mp4'),
      createContainerFn: vi.fn(async (context) => {
        const response = await instagramClient.createReelsContainer(context.accessToken, {
          videoUrl: context.videoUrl,
          caption: context.caption,
          shareToFeed: context.shareToFeed,
        });
        return { containerId: response.creation_id };
      }),
      fetchContainerStatusFn: vi.fn(async (accessToken, containerId) => {
        const status = await instagramClient.fetchContainerStatus(accessToken, containerId);
        return {
          status: status.status_code,
          errorMessage: status.error_message ?? null,
        };
      }),
      publishContainerFn: vi.fn(async () => ({ postId: 'should-not-publish' })),
      sleepMs: vi.fn(async () => undefined),
    });

    const { campaign } = await campaignService.createCampaign({
      title: 'Instagram failure',
      videoAssetId: 'asset-ig-failure',
    });
    const { target } = await campaignService.addTarget(campaign.id, {
      platform: 'instagram',
      destinationId: 'ig-account-001',
      destinationLabel: 'Instagram Creator',
      connectedAccountId: 'ig-account-001',
      videoTitle: 'Instagram Launch',
      videoDescription: 'Instagram description',
      privacy: 'public',
    });
    Object.assign(target, {
      instagramCaption: 'Instagram failure caption',
      instagramShareToFeed: true,
    });
    await campaignService.markReady(campaign.id);
    await launchService.launchCampaign(campaign.id);
    const [job] = await jobService.getJobsForTarget(target.id);

    const result = await worker.processPickedJob(job, target, campaign.videoAssetId);
    const final = await campaignService.getCampaign(campaign.id);

    expect(result).toMatchObject({
      status: 'failed',
      errorMessage: 'Media processing failed',
      errorClass: 'transient',
    });
    expect(final?.campaign.targets[0]).toMatchObject({
      status: 'erro',
      errorMessage: 'Media processing failed',
      externalPublishId: null,
    });
  });
});
