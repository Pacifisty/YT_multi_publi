import type { CampaignService } from './campaign.service';
import type { LaunchService } from './launch.service';

export interface ScheduledLaunchCheckerOptions {
  campaignService: CampaignService;
  launchService: LaunchService;
  now?: () => Date;
}

export class ScheduledLaunchChecker {
  private readonly campaignService: CampaignService;
  private readonly launchService: LaunchService;
  private readonly now: () => Date;

  constructor(options: ScheduledLaunchCheckerOptions) {
    this.campaignService = options.campaignService;
    this.launchService = options.launchService;
    this.now = options.now ?? (() => new Date());
  }

  /**
   * Checks all ready campaigns with a scheduledAt in the past and launches them.
   * Returns the IDs of campaigns that were launched.
   */
  async checkAndLaunch(): Promise<string[]> {
    const { campaigns } = await this.campaignService.listCampaigns();
    const nowMs = this.now().getTime();
    const launched: string[] = [];

    for (const campaign of campaigns) {
      if (campaign.status === 'launching') {
        await this.launchService.enqueueDueTargets(campaign.id);
        continue;
      }

      if (campaign.status !== 'ready') continue;
      if (!campaign.scheduledAt) continue;

      const scheduledMs = new Date(campaign.scheduledAt).getTime();
      if (scheduledMs > nowMs) continue;

      const result = await this.launchService.launchCampaign(campaign.id);
      if (!('error' in result)) {
        launched.push(campaign.id);
      }
    }

    return launched;
  }
}
