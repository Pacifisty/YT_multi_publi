import type { PublishJobRecord, PublishJobService } from './publish-job.service';
import type { CampaignService, CampaignTargetRecord } from './campaign.service';
import type { AuditEventService } from './audit-event.service';
import { classifyPublishError } from './error-classifier';
import { isChannelTokenResolverError } from '../integrations/youtube/channel-token-resolver';

export interface UploadContext {
  accessToken: string;
  filePath: string;
  thumbnailFilePath: string | null;
  title: string;
  description: string;
  tags: string[];
  playlistId: string | null;
  privacy: string;
}

export interface UploadResult {
  videoId: string;
}

export type YouTubeUploadFn = (context: UploadContext) => Promise<UploadResult>;

export class YouTubeUploadPartialFailureError extends Error {
  readonly videoId: string;

  constructor(message: string, videoId: string) {
    super(message);
    this.name = 'YouTubeUploadPartialFailureError';
    this.videoId = videoId;
  }
}

export interface YouTubeUploadWorkerOptions {
  jobService: PublishJobService;
  campaignService: CampaignService;
  auditService?: AuditEventService;
  uploadFn: YouTubeUploadFn;
  getAccessToken: (
    channelId: string,
    options?: { requirePlaylistWriteScope?: boolean },
  ) => Promise<string>;
  getVideoFilePath: (videoAssetId: string) => Promise<string>;
  getThumbnailFilePath?: (thumbnailAssetId: string) => Promise<string>;
}

const SYSTEM_AUDIT_ACTOR_EMAIL = 'system@internal';

function normalizeUploadErrorMessage(error: unknown): string {
  if (isChannelTokenResolverError(error) && error.code === 'REAUTH_REQUIRED') {
    return 'REAUTH_REQUIRED';
  }

  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : 'Unknown error';

  return message.trim() ? message.trim() : 'Unknown error';
}

export class YouTubeUploadWorker {
  private readonly jobService: PublishJobService;
  private readonly campaignService: CampaignService;
  private readonly auditService?: AuditEventService;
  private readonly uploadFn: YouTubeUploadFn;
  private readonly getAccessToken: (
    channelId: string,
    options?: { requirePlaylistWriteScope?: boolean },
  ) => Promise<string>;
  private readonly getVideoFilePath: (videoAssetId: string) => Promise<string>;
  private readonly getThumbnailFilePath?: (thumbnailAssetId: string) => Promise<string>;

  constructor(options: YouTubeUploadWorkerOptions) {
    this.jobService = options.jobService;
    this.campaignService = options.campaignService;
    this.auditService = options.auditService;
    this.uploadFn = options.uploadFn;
    this.getAccessToken = options.getAccessToken;
    this.getVideoFilePath = options.getVideoFilePath;
    this.getThumbnailFilePath = options.getThumbnailFilePath;
  }

  async processNext(): Promise<PublishJobRecord | null> {
    const job = await this.jobService.pickNext();
    if (!job) return null;

    // Find the target for this job
    const target = await this.findTargetForJob(job);
    if (!target) {
      return await this.jobService.markFailed(job.id, 'Target not found', { errorClass: 'permanent' });
    }

    // Find the campaign to get videoAssetId
    const campaignResult = await this.campaignService.getCampaign(target.campaignId);
    if (!campaignResult) {
      return this.jobService.markFailed(job.id, 'Campaign not found', { errorClass: 'permanent' });
    }

    return this.processPickedJob(job, target, campaignResult.campaign.videoAssetId);
  }

  async processPickedJob(
    job: PublishJobRecord,
    target: CampaignTargetRecord,
    campaignVideoAssetId: string,
  ): Promise<PublishJobRecord | null> {
    if (!target.channelId) {
      const failedJob = await this.jobService.markFailed(job.id, 'YouTube target is missing channelId', {
        errorClass: 'permanent',
      });
      await this.campaignService.updateTargetStatus(target.campaignId, target.id, 'erro', {
        errorMessage: 'YouTube target is missing channelId',
      });
      return failedJob;
    }

    try {
      const accessToken = target.playlistId
        ? await this.getAccessToken(target.channelId, { requirePlaylistWriteScope: true })
        : await this.getAccessToken(target.channelId);
      const filePath = await this.getVideoFilePath(campaignVideoAssetId);
      const thumbnailFilePath = target.thumbnailAssetId && this.getThumbnailFilePath
        ? await this.getThumbnailFilePath(target.thumbnailAssetId)
        : null;

      const result = await this.uploadFn({
        accessToken,
        filePath,
        thumbnailFilePath,
        title: target.videoTitle,
        description: target.videoDescription,
        tags: target.tags,
        playlistId: target.playlistId,
        privacy: target.privacy,
      });

      const completedJob = await this.jobService.markCompleted(job.id, result.videoId);
      await this.campaignService.updateTargetStatus(target.campaignId, target.id, 'publicado', {
        externalPublishId: result.videoId,
        youtubeVideoId: result.videoId,
      });

      if (this.auditService) {
        await this.auditService.record({
          eventType: 'publish_completed',
          actorEmail: SYSTEM_AUDIT_ACTOR_EMAIL,
          campaignId: target.campaignId,
          targetId: target.id,
        });
      }

      return completedJob;
    } catch (error) {
      const errorMessage = normalizeUploadErrorMessage(error);
      const uploadedVideoId = error instanceof YouTubeUploadPartialFailureError
        ? error.videoId
        : undefined;
      const errorClass = error instanceof YouTubeUploadPartialFailureError
        ? 'permanent'
        : classifyPublishError(error);

      const failedJob = await this.jobService.markFailed(job.id, errorMessage, {
        errorClass,
        youtubeVideoId: uploadedVideoId,
      });
      await this.campaignService.updateTargetStatus(target.campaignId, target.id, 'erro', {
        errorMessage,
        externalPublishId: uploadedVideoId,
        youtubeVideoId: uploadedVideoId,
      });

      if (this.auditService) {
        await this.auditService.record({
          eventType: error instanceof YouTubeUploadPartialFailureError ? 'publish_partial_failure' : 'publish_failed',
          actorEmail: SYSTEM_AUDIT_ACTOR_EMAIL,
          campaignId: target.campaignId,
          targetId: target.id,
        });
      }

      return failedJob;
    }
  }

  private async findTargetForJob(job: PublishJobRecord): Promise<CampaignTargetRecord | null> {
    // Search all campaigns for the target matching this job
    const { campaigns } = await this.campaignService.listCampaigns();
    for (const campaign of campaigns) {
      const target = campaign.targets.find((t) => t.id === job.campaignTargetId);
      if (target) return target;
    }
    return null;
  }
}

/**
 * Default YouTube upload implementation using googleapis.
 * Performs a resumable upload streaming from disk.
 */
export async function youtubeResumableUpload(context: UploadContext): Promise<UploadResult> {
  const { createReadStream } = await import('node:fs');
  const { google } = await import('googleapis');

  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: context.accessToken });

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  const response = await youtube.videos.insert({
    part: ['snippet', 'status'],
    requestBody: {
      snippet: {
        title: context.title,
        description: context.description,
        tags: context.tags,
      },
      status: {
        privacyStatus: context.privacy,
      },
    },
    media: {
      body: createReadStream(context.filePath),
    },
  });

  if (!response.data.id) {
    throw new Error('YouTube API did not return a video ID');
  }

  if (context.playlistId) {
    try {
      await youtube.playlistItems.insert({
        part: ['snippet'],
        requestBody: {
          snippet: {
            playlistId: context.playlistId,
            resourceId: {
              kind: 'youtube#video',
              videoId: response.data.id,
            },
          },
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new YouTubeUploadPartialFailureError(
        `Video uploaded as ${response.data.id}, but adding it to playlist failed: ${message}`,
        response.data.id,
      );
    }
  }

  if (context.thumbnailFilePath) {
    try {
      await youtube.thumbnails.set({
        videoId: response.data.id,
        media: {
          body: createReadStream(context.thumbnailFilePath),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new YouTubeUploadPartialFailureError(
        `Video uploaded as ${response.data.id}, but applying the thumbnail failed: ${message}`,
        response.data.id,
      );
    }
  }

  return { videoId: response.data.id };
}
