import type { CampaignService } from './campaign.service';
import type { PublishJobService } from './publish-job.service';

export interface TargetStatusView {
  targetId: string;
  platform: string;
  channelId: string | null;
  connectedAccountId: string | null;
  videoTitle: string;
  status: string;
  publishAt: string | null;
  scheduledPending: boolean;
  youtubeVideoId: string | null;
  externalPublishId: string | null;
  errorMessage: string | null;
  latestJobStatus: string | null;
  reauthRequired: boolean;
  hasPostUploadWarning: boolean;
  reviewYoutubeUrl: string | null;
}

export interface CampaignStatusResult {
  campaignId: string;
  campaignStatus: string;
  targets: TargetStatusView[];
  shouldPoll: boolean;
  nextScheduledAt: string | null;
  progress: {
    completed: number;
    failed: number;
    total: number;
  };
}

export interface CampaignStatusServiceOptions {
  campaignService: CampaignService;
  jobService: PublishJobService;
  now?: () => Date;
}

function isTerminalTarget(target: Pick<TargetStatusView, 'status' | 'youtubeVideoId' | 'externalPublishId' | 'errorMessage'>): boolean {
  return (target.status === 'erro' && Boolean(target.errorMessage)) || (target.status === 'publicado' && (Boolean(target.youtubeVideoId) || Boolean(target.externalPublishId)));
}

function hasPostUploadWarning(target: Pick<TargetStatusView, 'status' | 'youtubeVideoId' | 'errorMessage'>): boolean {
  return target.status === 'erro' &&
    Boolean(target.youtubeVideoId) &&
    typeof target.errorMessage === 'string' &&
    target.errorMessage.includes(`Video uploaded as ${target.youtubeVideoId}, but `);
}

function isReauthRequired(target: Pick<TargetStatusView, 'status' | 'errorMessage'>): boolean {
  return target.status === 'erro' && target.errorMessage === 'REAUTH_REQUIRED';
}

export class CampaignStatusService {
  private readonly campaignService: CampaignService;
  private readonly jobService: PublishJobService;
  private readonly now: () => Date;

  constructor(options: CampaignStatusServiceOptions) {
    this.campaignService = options.campaignService;
    this.jobService = options.jobService;
    this.now = options.now ?? (() => new Date());
  }

  private isScheduledPending(target: { status: string; publishAt: string | null }): boolean {
    return target.status === 'aguardando' &&
      typeof target.publishAt === 'string' &&
      new Date(target.publishAt).getTime() > this.now().getTime();
  }

  private getNextScheduledAt(targets: TargetStatusView[]): string | null {
    const scheduledTargets = targets
      .filter((target) => target.scheduledPending && typeof target.publishAt === 'string')
      .sort((left, right) => new Date(left.publishAt!).getTime() - new Date(right.publishAt!).getTime());

    return scheduledTargets[0]?.publishAt ?? null;
  }

  async getStatus(campaignId: string): Promise<CampaignStatusResult | null> {
    const result = await this.campaignService.getCampaign(campaignId);
    if (!result) return null;

    const { campaign } = result;

    const targets: TargetStatusView[] = await Promise.all(campaign.targets.map(async (t) => {
      const jobs = await this.jobService.getJobsForTarget(t.id);
      const latestJob = jobs.length > 0 ? jobs[jobs.length - 1] : null;
      const scheduledPending = this.isScheduledPending(t);

      return {
        targetId: t.id,
        platform: t.platform,
        channelId: t.channelId,
        connectedAccountId: t.connectedAccountId,
        videoTitle: t.videoTitle,
        status: t.status,
        publishAt: t.publishAt,
        scheduledPending,
        youtubeVideoId: t.youtubeVideoId,
        externalPublishId: t.externalPublishId,
        errorMessage: t.errorMessage,
        latestJobStatus: latestJob?.status ?? null,
        reauthRequired: isReauthRequired(t),
        hasPostUploadWarning: hasPostUploadWarning(t),
        reviewYoutubeUrl: hasPostUploadWarning(t) && t.youtubeVideoId
          ? `https://www.youtube.com/watch?v=${t.youtubeVideoId}`
          : null,
      };
    }));

    const allTerminal = targets.length > 0 && targets.every((t) => isTerminalTarget(t));
    const completed = targets.filter((t) => t.status === 'publicado' && (t.youtubeVideoId || t.externalPublishId)).length;
    const failed = targets.filter((t) => t.status === 'erro' && t.errorMessage).length;
    const hasActivePendingTargets = targets.some((target) =>
      target.status === 'enviando' || (target.status === 'aguardando' && !target.scheduledPending));
    const nextScheduledAt = this.getNextScheduledAt(targets);

    const shouldPoll = campaign.status === 'launching' && targets.length > 0 && !allTerminal && hasActivePendingTargets;

    return {
      campaignId: campaign.id,
      campaignStatus: campaign.status,
      targets,
      shouldPoll,
      nextScheduledAt,
      progress: {
        completed,
        failed,
        total: targets.length,
      },
    };
  }
}
