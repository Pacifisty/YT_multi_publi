import type { CampaignService } from './campaign.service';
import type { PublishJobService } from './publish-job.service';

export interface TargetStatusView {
  targetId: string;
  channelId: string;
  videoTitle: string;
  status: string;
  youtubeVideoId: string | null;
  errorMessage: string | null;
  latestJobStatus: string | null;
}

export interface CampaignStatusResult {
  campaignId: string;
  campaignStatus: string;
  targets: TargetStatusView[];
  shouldPoll: boolean;
  progress: {
    completed: number;
    failed: number;
    total: number;
  };
}

export interface CampaignStatusServiceOptions {
  campaignService: CampaignService;
  jobService: PublishJobService;
}

function isTerminalTarget(target: Pick<TargetStatusView, 'status' | 'youtubeVideoId'>): boolean {
  return target.status === 'erro' || (target.status === 'publicado' && Boolean(target.youtubeVideoId));
}

export class CampaignStatusService {
  private readonly campaignService: CampaignService;
  private readonly jobService: PublishJobService;

  constructor(options: CampaignStatusServiceOptions) {
    this.campaignService = options.campaignService;
    this.jobService = options.jobService;
  }

  async getStatus(campaignId: string): Promise<CampaignStatusResult | null> {
    const result = await this.campaignService.getCampaign(campaignId);
    if (!result) return null;

    const { campaign } = result;

    const targets: TargetStatusView[] = await Promise.all(campaign.targets.map(async (t) => {
      const jobs = await this.jobService.getJobsForTarget(t.id);
      const latestJob = jobs.length > 0 ? jobs[jobs.length - 1] : null;

      return {
        targetId: t.id,
        channelId: t.channelId,
        videoTitle: t.videoTitle,
        status: t.status,
        youtubeVideoId: t.youtubeVideoId,
        errorMessage: t.errorMessage,
        latestJobStatus: latestJob?.status ?? null,
      };
    }));

    const allTerminal = targets.length > 0 && targets.every((t) => isTerminalTarget(t));
    const completed = targets.filter((t) => t.status === 'publicado' && t.youtubeVideoId).length;
    const failed = targets.filter((t) => t.status === 'erro').length;

    const shouldPoll = campaign.status === 'launching' && targets.length > 0 && !allTerminal;

    return {
      campaignId: campaign.id,
      campaignStatus: campaign.status,
      targets,
      shouldPoll,
      progress: {
        completed,
        failed,
        total: targets.length,
      },
    };
  }
}
