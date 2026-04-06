import type { PublishJobRecord, PublishJobService } from './publish-job.service';
import type { CampaignService, CampaignTargetRecord } from './campaign.service';

export interface UploadContext {
  accessToken: string;
  filePath: string;
  title: string;
  description: string;
  tags: string[];
  privacy: string;
}

export interface UploadResult {
  videoId: string;
}

export type YouTubeUploadFn = (context: UploadContext) => Promise<UploadResult>;

export interface YouTubeUploadWorkerOptions {
  jobService: PublishJobService;
  campaignService: CampaignService;
  uploadFn: YouTubeUploadFn;
  getAccessToken: (channelId: string) => Promise<string>;
  getVideoFilePath: (videoAssetId: string) => Promise<string>;
}

export class YouTubeUploadWorker {
  private readonly jobService: PublishJobService;
  private readonly campaignService: CampaignService;
  private readonly uploadFn: YouTubeUploadFn;
  private readonly getAccessToken: (channelId: string) => Promise<string>;
  private readonly getVideoFilePath: (videoAssetId: string) => Promise<string>;

  constructor(options: YouTubeUploadWorkerOptions) {
    this.jobService = options.jobService;
    this.campaignService = options.campaignService;
    this.uploadFn = options.uploadFn;
    this.getAccessToken = options.getAccessToken;
    this.getVideoFilePath = options.getVideoFilePath;
  }

  async processNext(): Promise<PublishJobRecord | null> {
    const job = await this.jobService.pickNext();
    if (!job) return null;

    // Find the target for this job
    const target = await this.findTargetForJob(job);
    if (!target) {
      return await this.jobService.markFailed(job.id, 'Target not found');
    }

    // Find the campaign to get videoAssetId
    const campaignResult = await this.campaignService.getCampaign(target.campaignId);
    if (!campaignResult) {
      return this.jobService.markFailed(job.id, 'Campaign not found');
    }

    try {
      const accessToken = await this.getAccessToken(target.channelId);
      const filePath = await this.getVideoFilePath(campaignResult.campaign.videoAssetId);

      const result = await this.uploadFn({
        accessToken,
        filePath,
        title: target.videoTitle,
        description: target.videoDescription,
        tags: target.tags,
        privacy: target.privacy,
      });

      // Mark job completed
      const completedJob = await this.jobService.markCompleted(job.id, result.videoId);

      // Update target status
      await this.campaignService.updateTargetStatus(target.campaignId, target.id, 'publicado', {
        youtubeVideoId: result.videoId,
      });

      return completedJob;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Mark job failed
      const failedJob = await this.jobService.markFailed(job.id, errorMessage);

      // Update target status
      await this.campaignService.updateTargetStatus(target.campaignId, target.id, 'erro', {
        errorMessage,
      });

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

  return { videoId: response.data.id };
}
