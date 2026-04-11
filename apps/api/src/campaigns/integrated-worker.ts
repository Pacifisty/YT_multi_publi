import type { CampaignService } from './campaign.service';
import type { PublishJobService } from './publish-job.service';
import type { AuditEventService } from './audit-event.service';
import { YouTubeUploadWorker, type YouTubeUploadFn } from './youtube-upload.worker';
import { JobRunner } from './job-runner';
import { YouTubeUploadService, type ChannelTokenResolver, type VideoFileResolver } from '../integrations/youtube/youtube-upload.service';

export interface IntegratedWorkerOptions {
  campaignService: CampaignService;
  jobService: PublishJobService;
  auditService?: AuditEventService;
  uploadFn: YouTubeUploadFn;
  channelTokenResolver: ChannelTokenResolver;
  videoFileResolver: VideoFileResolver;
}

export interface IntegratedWorkerInstance {
  worker: YouTubeUploadWorker;
  runner: JobRunner;
  uploadService: YouTubeUploadService;
}

export function createIntegratedWorker(options: IntegratedWorkerOptions): IntegratedWorkerInstance {
  const uploadService = new YouTubeUploadService({
    uploadFn: options.uploadFn,
    channelTokenResolver: options.channelTokenResolver,
    videoFileResolver: options.videoFileResolver,
  });

  const worker = new YouTubeUploadWorker({
    jobService: options.jobService,
    campaignService: options.campaignService,
    auditService: options.auditService,
    uploadFn: options.uploadFn,
    getAccessToken: (channelId) => uploadService.getAccessToken(channelId),
    getVideoFilePath: (videoAssetId) => uploadService.getVideoFilePath(videoAssetId),
  });

  const runner = new JobRunner({ worker });

  return { worker, runner, uploadService };
}
