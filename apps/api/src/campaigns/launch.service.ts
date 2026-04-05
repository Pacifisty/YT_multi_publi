import type { CampaignRecord } from './campaign.service';
import { CampaignService } from './campaign.service';
import { PublishJobService } from './publish-job.service';

export interface LaunchServiceOptions {
  campaignService: CampaignService;
  jobService: PublishJobService;
}

export class LaunchService {
  private readonly campaignService: CampaignService;
  private readonly jobService: PublishJobService;

  constructor(options: LaunchServiceOptions) {
    this.campaignService = options.campaignService;
    this.jobService = options.jobService;
  }

  launchCampaign(campaignId: string): { campaign: CampaignRecord } | { error: string } {
    const result = this.campaignService.launch(campaignId);

    if ('error' in result) {
      return result;
    }

    // Enqueue one job per target
    const targets = result.campaign.targets.map((t) => ({
      id: t.id,
      campaignId: result.campaign.id,
    }));

    this.jobService.enqueueForTargets(targets);

    return result;
  }
}
