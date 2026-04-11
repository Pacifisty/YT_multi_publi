import type { AuditEventService, AuditEventType } from './audit-event.service';
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
  quota: {
    dailyLimitUnits: number;
    estimatedConsumedUnits: number;
    estimatedQueuedUnits: number;
    estimatedProjectedUnits: number;
    estimatedRemainingUnits: number;
    usagePercent: number;
    projectedPercent: number;
    warningState: 'healthy' | 'warning' | 'critical';
  };
  failures: {
    failedCampaigns: number;
    failedTargets: number;
    topReason: 'quota_exceeded' | 'post_upload_step_failed' | 'other_failure' | null;
    reasons: Array<{
      reason: 'quota_exceeded' | 'post_upload_step_failed' | 'other_failure';
      count: number;
    }>;
  };
  retries: {
    retriedTargets: number;
    highestAttempt: number;
    hotspotChannelId: string | null;
    hotspotRetryCount: number;
  };
  audit: {
    totalEvents: number;
    byType: Record<AuditEventType, number>;
    lastEventAt: string | null;
    lastEventType: AuditEventType | null;
    lastActorEmail: string | null;
  };
  reauth: {
    blockedCampaigns: number;
    blockedTargets: number;
    blockedChannelCount: number;
    blockedChannelIds: string[];
  };
  channels: ChannelStats[];
}

export interface DashboardServiceOptions {
  campaignService: CampaignService;
  jobService: PublishJobService;
  auditService?: AuditEventService;
}

export class DashboardService {
  private static readonly DAILY_QUOTA_LIMIT_UNITS = 10000;
  private static readonly UPLOAD_ATTEMPT_UNITS = 100;
  private static readonly PLAYLIST_ATTACH_UNITS = 50;
  private static readonly THUMBNAIL_SET_UNITS = 50;
  private static readonly WARNING_USAGE_PERCENT = 80;
  private static readonly CRITICAL_USAGE_PERCENT = 95;

  private readonly campaignService: CampaignService;
  private readonly jobService: PublishJobService;
  private readonly auditService?: AuditEventService;

  constructor(options: DashboardServiceOptions) {
    this.campaignService = options.campaignService;
    this.jobService = options.jobService;
    this.auditService = options.auditService;
  }

  private classifyFailureReason(errorMessage: string | null): 'quota_exceeded' | 'post_upload_step_failed' | 'other_failure' | null {
    if (!errorMessage || errorMessage === 'REAUTH_REQUIRED') {
      return null;
    }
    if (errorMessage === 'quotaExceeded' || errorMessage.toLowerCase().includes('quota')) {
      return 'quota_exceeded';
    }
    if (errorMessage.startsWith('Video uploaded as ')) {
      return 'post_upload_step_failed';
    }
    return 'other_failure';
  }

  async getStats(): Promise<DashboardStats> {
    const { campaigns } = await this.campaignService.listCampaigns();
    const allJobs = await this.jobService.getAllJobs();
    const auditEvents = this.auditService ? await this.auditService.listEvents() : [];

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
    const targetById = new Map(allTargets.map((target) => [target.id, target]));
    const reauthTargets = allTargets.filter((target) => target.errorMessage === 'REAUTH_REQUIRED');
    const failedTargets = allTargets
      .map((target) => ({
        target,
        reason: this.classifyFailureReason(target.errorMessage),
      }))
      .filter((entry): entry is { target: CampaignTargetRecord; reason: 'quota_exceeded' | 'post_upload_step_failed' | 'other_failure' } =>
        entry.target.status === 'erro' && entry.reason !== null);
    const reauthChannelIds = [...new Set(reauthTargets.map((target) => target.channelId))].sort();
    const reauthCampaignIds = [...new Set(
      campaigns
        .filter((campaign) => campaign.targets.some((target) => target.errorMessage === 'REAUTH_REQUIRED'))
        .map((campaign) => campaign.id),
    )];
    const failureCampaignIds = [...new Set(failedTargets.map((entry) => entry.target.campaignId))];
    const failureReasonCounts = new Map<'quota_exceeded' | 'post_upload_step_failed' | 'other_failure', number>();
    const retryCountsByChannel = new Map<string, number>();
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
    for (const entry of failedTargets) {
      failureReasonCounts.set(entry.reason, (failureReasonCounts.get(entry.reason) ?? 0) + 1);
    }

    const totalTerminalTargets = targetByStatus.publicado + targetByStatus.erro;
    const successRate = totalTerminalTargets > 0
      ? Math.round((targetByStatus.publicado / totalTerminalTargets) * 10000) / 100
      : 0;

    // Job breakdown
    const jobByStatus: Record<string, number> = { queued: 0, processing: 0, completed: 0, failed: 0 };
    let totalRetries = 0;
    let estimatedConsumedUnits = 0;
    let estimatedQueuedUnits = 0;
    let retriedTargets = 0;
    let highestAttempt = 0;
    for (const j of allJobs) {
      jobByStatus[j.status]++;
      if (j.attempt > 1) {
        const retryCount = j.attempt - 1;
        totalRetries += retryCount;
        retriedTargets += 1;
        highestAttempt = Math.max(highestAttempt, j.attempt);

        const target = targetById.get(j.campaignTargetId);
        if (target) {
          retryCountsByChannel.set(
            target.channelId,
            (retryCountsByChannel.get(target.channelId) ?? 0) + retryCount,
          );
        }
      }

      const consumedAttempts = j.status === 'queued' ? Math.max(j.attempt - 1, 0) : j.attempt;
      estimatedConsumedUnits += consumedAttempts * DashboardService.UPLOAD_ATTEMPT_UNITS;

      if (j.status === 'queued') {
        estimatedQueuedUnits += DashboardService.UPLOAD_ATTEMPT_UNITS;
        const target = targetById.get(j.campaignTargetId);
        if (target?.playlistId) {
          estimatedQueuedUnits += DashboardService.PLAYLIST_ATTACH_UNITS;
        }
        if (target?.thumbnailAssetId) {
          estimatedQueuedUnits += DashboardService.THUMBNAIL_SET_UNITS;
        }
      }
    }

    for (const target of allTargets) {
      if (!target.youtubeVideoId) {
        continue;
      }
      if (target.playlistId) {
        estimatedConsumedUnits += DashboardService.PLAYLIST_ATTACH_UNITS;
      }
      if (target.thumbnailAssetId) {
        estimatedConsumedUnits += DashboardService.THUMBNAIL_SET_UNITS;
      }
    }

    const dailyLimitUnits = DashboardService.DAILY_QUOTA_LIMIT_UNITS;
    const estimatedProjectedUnits = estimatedConsumedUnits + estimatedQueuedUnits;
    const estimatedRemainingUnits = Math.max(dailyLimitUnits - estimatedConsumedUnits, 0);
    const usagePercent = dailyLimitUnits > 0
      ? Math.round((estimatedConsumedUnits / dailyLimitUnits) * 10000) / 100
      : 0;
    const projectedPercent = dailyLimitUnits > 0
      ? Math.round((estimatedProjectedUnits / dailyLimitUnits) * 10000) / 100
      : 0;
    const warningState = projectedPercent >= DashboardService.CRITICAL_USAGE_PERCENT
      ? 'critical'
      : projectedPercent >= DashboardService.WARNING_USAGE_PERCENT
        ? 'warning'
        : 'healthy';
    const reasons = [...failureReasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));
    const topReason = reasons[0]?.reason ?? null;
    const retryHotspot = [...retryCountsByChannel.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    const hotspotChannelId = retryHotspot?.[0] ?? null;
    const hotspotRetryCount = retryHotspot?.[1] ?? 0;
    const auditByType: Record<AuditEventType, number> = {
      launch_campaign: 0,
      retry_target: 0,
      mark_ready: 0,
      clone_campaign: 0,
      delete_campaign: 0,
      update_campaign: 0,
      remove_target: 0,
      update_target: 0,
      add_target: 0,
      add_targets_bulk: 0,
      publish_completed: 0,
      publish_failed: 0,
      publish_partial_failure: 0,
    };
    for (const event of auditEvents) {
      auditByType[event.eventType] += 1;
    }
    const latestAuditEvent = auditEvents[0] ?? null;

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
      quota: {
        dailyLimitUnits,
        estimatedConsumedUnits,
        estimatedQueuedUnits,
        estimatedProjectedUnits,
        estimatedRemainingUnits,
        usagePercent,
        projectedPercent,
        warningState,
      },
      failures: {
        failedCampaigns: failureCampaignIds.length,
        failedTargets: failedTargets.length,
        topReason,
        reasons,
      },
      retries: {
        retriedTargets,
        highestAttempt,
        hotspotChannelId,
        hotspotRetryCount,
      },
      audit: {
        totalEvents: auditEvents.length,
        byType: auditByType,
        lastEventAt: latestAuditEvent?.createdAt ?? null,
        lastEventType: latestAuditEvent?.eventType ?? null,
        lastActorEmail: latestAuditEvent?.actorEmail ?? null,
      },
      reauth: {
        blockedCampaigns: reauthCampaignIds.length,
        blockedTargets: reauthTargets.length,
        blockedChannelCount: reauthChannelIds.length,
        blockedChannelIds: reauthChannelIds,
      },
      channels,
    };
  }
}
