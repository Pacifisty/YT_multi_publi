import type { CampaignService } from './campaign.service';
import type { PublishJobService } from './publish-job.service';
import type { AuditEventService } from './audit-event.service';
import { YouTubeUploadWorker, type YouTubeUploadFn } from './youtube-upload.worker';
import { InstagramUploadWorker, instagramGraphPublish, type InstagramPublishFn } from './instagram-upload.worker';
import { TikTokUploadWorker } from './tiktok-upload.worker';
import { PlatformDispatchWorker } from './platform-dispatch.worker';
import { JobRunner } from './job-runner';
import {
  YouTubeUploadService,
  type ChannelTokenResolver,
  type VideoFileResolver,
  type ThumbnailFileResolver,
} from '../integrations/youtube/youtube-upload.service';

export interface IntegratedWorkerOptions {
  campaignService: CampaignService;
  jobService: PublishJobService;
  auditService?: AuditEventService;
  uploadFn: YouTubeUploadFn;
  instagramPublishFn?: InstagramPublishFn;
  channelTokenResolver: ChannelTokenResolver;
  videoFileResolver: VideoFileResolver;
  thumbnailFileResolver?: ThumbnailFileResolver;
  getAccessTokenForConnectedAccount?: (connectedAccountId: string) => Promise<string>;
  getPublicVideoUrl?: (videoAssetId: string) => Promise<string>;
}

export interface IntegratedWorkerInstance {
  worker: PlatformDispatchWorker;
  runner: JobRunner;
  uploadService: YouTubeUploadService;
  youtubeWorker: YouTubeUploadWorker;
  instagramWorker: InstagramUploadWorker;
  tiktokWorker: TikTokUploadWorker;
}

export function createIntegratedWorker(options: IntegratedWorkerOptions): IntegratedWorkerInstance {
  const uploadService = new YouTubeUploadService({
    uploadFn: options.uploadFn,
    channelTokenResolver: options.channelTokenResolver,
    videoFileResolver: options.videoFileResolver,
    thumbnailFileResolver: options.thumbnailFileResolver,
  });

  const youtubeWorker = new YouTubeUploadWorker({
    jobService: options.jobService,
    campaignService: options.campaignService,
    auditService: options.auditService,
    uploadFn: options.uploadFn,
    getAccessToken: (channelId, options) => uploadService.getAccessToken(channelId, options),
    getVideoFilePath: (videoAssetId) => uploadService.getVideoFilePath(videoAssetId),
    getThumbnailFilePath: options.thumbnailFileResolver
      ? (thumbnailAssetId) => options.thumbnailFileResolver!.resolve(thumbnailAssetId)
      : undefined,
  });

  const instagramWorker = new InstagramUploadWorker({
    jobService: options.jobService,
    campaignService: options.campaignService,
    auditService: options.auditService,
    publishFn: options.instagramPublishFn ?? instagramGraphPublish,
    getAccessToken: options.getAccessTokenForConnectedAccount ?? (async () => {
      throw new Error('Instagram publishing is not configured.');
    }),
    getPublicVideoUrl: options.getPublicVideoUrl ?? (async () => {
      throw new Error('Public media URLs are not configured.');
    }),
  });

  const tiktokWorker = new TikTokUploadWorker({
    jobService: options.jobService,
    campaignService: options.campaignService,
    auditService: options.auditService,
    getAccessToken: options.getAccessTokenForConnectedAccount ?? (async () => {
      throw new Error('TikTok publishing is not configured.');
    }),
    getPublicVideoUrl: options.getPublicVideoUrl ?? (async () => {
      throw new Error('Public media URLs are not configured.');
    }),
  });

  const worker = new PlatformDispatchWorker({
    jobService: options.jobService,
    campaignService: options.campaignService,
    youtubeWorker,
    instagramWorker,
    tiktokWorker,
  });

  const runner = new JobRunner({ worker });

  return { worker, runner, uploadService, youtubeWorker, instagramWorker, tiktokWorker };
}
