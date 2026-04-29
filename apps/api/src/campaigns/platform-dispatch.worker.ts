import type { PublishJobRecord, PublishJobService } from './publish-job.service';
import type { CampaignService, CampaignTargetRecord } from './campaign.service';
import type { YouTubeUploadWorker } from './youtube-upload.worker';
import type { TikTokUploadWorker } from './tiktok-upload.worker';
import type { InstagramUploadWorker } from './instagram-upload.worker';

export interface PlatformDispatchWorkerOptions {
  jobService: PublishJobService;
  campaignService: CampaignService;
  youtubeWorker: YouTubeUploadWorker;
  tiktokWorker: TikTokUploadWorker;
  instagramWorker?: InstagramUploadWorker;
}

export class PlatformDispatchWorker {
  private readonly jobService: PublishJobService;
  private readonly campaignService: CampaignService;
  private readonly youtubeWorker: YouTubeUploadWorker;
  private readonly tiktokWorker: TikTokUploadWorker;
  private readonly instagramWorker?: InstagramUploadWorker;

  constructor(options: PlatformDispatchWorkerOptions) {
    this.jobService = options.jobService;
    this.campaignService = options.campaignService;
    this.youtubeWorker = options.youtubeWorker;
    this.tiktokWorker = options.tiktokWorker;
    this.instagramWorker = options.instagramWorker;
  }

  async processNext(): Promise<PublishJobRecord | null> {
    const job = await this.jobService.pickNext();
    if (!job) {
      return null;
    }

    const target = await this.findTargetForJob(job);
    if (!target) {
      return this.jobService.markFailed(job.id, 'Target not found');
    }

    const campaignResult = await this.campaignService.getCampaign(target.campaignId);
    if (!campaignResult) {
      return this.jobService.markFailed(job.id, 'Campaign not found');
    }

    if (target.platform === 'youtube') {
      return this.youtubeWorker.processPickedJob(job, target, campaignResult.campaign.videoAssetId);
    }

    if (target.platform === 'tiktok') {
      return this.tiktokWorker.processPickedJob(job, target, campaignResult.campaign.videoAssetId);
    }

    if (target.platform === 'instagram' && this.instagramWorker) {
      return this.instagramWorker.processPickedJob(job, target, campaignResult.campaign.videoAssetId);
    }

    const failedJob = await this.jobService.markFailed(job.id, `Publishing for platform ${target.platform} is not implemented yet.`);
    await this.campaignService.updateTargetStatus(target.campaignId, target.id, 'erro', {
      errorMessage: `Publishing for platform ${target.platform} is not implemented yet.`,
    });
    return failedJob;
  }

  private async findTargetForJob(job: PublishJobRecord): Promise<CampaignTargetRecord | null> {
    const { campaigns } = await this.campaignService.listCampaigns();
    for (const campaign of campaigns) {
      const target = campaign.targets.find((entry) => entry.id === job.campaignTargetId);
      if (target) {
        return target;
      }
    }
    return null;
  }
}
