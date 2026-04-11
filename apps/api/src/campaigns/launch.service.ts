import type { CampaignRecord, CampaignTargetRecord } from './campaign.service';
import { CampaignService } from './campaign.service';
import { PublishJobService } from './publish-job.service';

export interface LaunchServiceOptions {
  campaignService: CampaignService;
  jobService: PublishJobService;
  now?: () => Date;
}

export class LaunchService {
  private readonly campaignService: CampaignService;
  private readonly jobService: PublishJobService;
  private readonly now: () => Date;

  constructor(options: LaunchServiceOptions) {
    this.campaignService = options.campaignService;
    this.jobService = options.jobService;
    this.now = options.now ?? (() => new Date());
  }

  private isTargetDue(target: CampaignTargetRecord): boolean {
    if (!target.publishAt) {
      return true;
    }

    return new Date(target.publishAt).getTime() <= this.now().getTime();
  }

  private async getTargetsReadyToEnqueue(campaign: CampaignRecord): Promise<{ id: string; campaignId: string }[]> {
    const readyTargets: { id: string; campaignId: string }[] = [];

    for (const target of campaign.targets) {
      if (target.status !== 'aguardando' || !this.isTargetDue(target)) {
        continue;
      }

      const existingJobs = await this.jobService.getJobsForTarget(target.id);
      if (existingJobs.length > 0) {
        continue;
      }

      readyTargets.push({
        id: target.id,
        campaignId: campaign.id,
      });
    }

    return readyTargets;
  }

  async launchCampaign(campaignId: string): Promise<{ campaign: CampaignRecord } | { error: string }> {
    const result = await this.campaignService.launch(campaignId);

    if ('error' in result) {
      return result;
    }

    const targets = await this.getTargetsReadyToEnqueue(result.campaign);

    await this.jobService.enqueueForTargets(targets);

    return result;
  }

  async enqueueDueTargets(campaignId: string): Promise<string[]> {
    const campaignResult = await this.campaignService.getCampaign(campaignId);
    if (!campaignResult || campaignResult.campaign.status !== 'launching') {
      return [];
    }

    const targets = await this.getTargetsReadyToEnqueue(campaignResult.campaign);
    if (targets.length === 0) {
      return [];
    }

    await this.jobService.enqueueForTargets(targets);
    return targets.map((target) => target.id);
  }
}
