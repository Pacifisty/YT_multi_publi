import type { CampaignService, CampaignRecord, CampaignTargetRecord } from './campaign.service';
import type { PublishJobService } from './publish-job.service';

export interface ChannelStats {
  channelId: string;
  totalTargets: number;
  published: number;
  failed: number;
  successRate: number;
}

export interface DashboardStats {
  campaigns: {
    total: number;
    byStatus: Record<CampaignRecord['status'], number>;
  };
  targets: {
    total: number;
    byStatus: Record<CampaignTargetRecord['status'], number>;
    successRate: number;
  };
  jobs: {
    total: number;
    byStatus: Record<string, number>;
    totalRetries: number;
  };
  channels: ChannelStats[];
}

export interface DashboardServiceOptions {
  campaignService: CampaignService;
  jobService: PublishJobService;
}

export class DashboardService {
  private readonly campaignService: CampaignService;
  private readonly jobService: PublishJobService;

  constructor(options: DashboardServiceOptions) {
    this.campaignService = options.campaignService;
    this.jobService = options.jobService;
  }

  async getStats(): Promise<DashboardStats> {
    const { campaigns } = await this.campaignService.listCampaigns();
    const allJobs = await this.jobService.getAllJobs();

    // Campaign breakdown
    const campaignByStatus: Record<CampaignRecord['status'], number> = {
      draft: 0, ready: 0, launching: 0, completed: 0, failed: 0,
    };
    for (const c of campaigns) {
      campaignByStatus[c.status]++;
    }

    // Target breakdown + per-channel aggregation
    const targetByStatus: Record<CampaignTargetRecord['status'], number> = {
      aguardando: 0, enviando: 0, publicado: 0, erro: 0,
    };
    const channelMap = new Map<string, { total: number; published: number; failed: number }>();

    const allTargets = campaigns.flatMap((c) => c.targets);
    for (const t of allTargets) {
      targetByStatus[t.status]++;

      if (!channelMap.has(t.channelId)) {
        channelMap.set(t.channelId, { total: 0, published: 0, failed: 0 });
      }
      const ch = channelMap.get(t.channelId)!;
      ch.total++;
      if (t.status === 'publicado') ch.published++;
      if (t.status === 'erro') ch.failed++;
    }

    const totalTerminalTargets = targetByStatus.publicado + targetByStatus.erro;
    const successRate = totalTerminalTargets > 0
      ? Math.round((targetByStatus.publicado / totalTerminalTargets) * 10000) / 100
      : 0;

    // Job breakdown
    const jobByStatus: Record<string, number> = { queued: 0, processing: 0, completed: 0, failed: 0 };
    let totalRetries = 0;
    for (const j of allJobs) {
      jobByStatus[j.status]++;
      if (j.attempt > 1) totalRetries += j.attempt - 1;
    }

    // Channel stats
    const channels: ChannelStats[] = [];
    for (const [channelId, data] of channelMap) {
      const termTotal = data.published + data.failed;
      channels.push({
        channelId,
        totalTargets: data.total,
        published: data.published,
        failed: data.failed,
        successRate: termTotal > 0 ? Math.round((data.published / termTotal) * 10000) / 100 : 0,
      });
    }

    return {
      campaigns: { total: campaigns.length, byStatus: campaignByStatus },
      targets: { total: allTargets.length, byStatus: targetByStatus, successRate },
      jobs: { total: allJobs.length, byStatus: jobByStatus, totalRetries },
      channels,
    };
  }
}
