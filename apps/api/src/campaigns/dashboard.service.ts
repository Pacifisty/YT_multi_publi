import type { AuditEventService, AuditEventType } from './audit-event.service';
import type { CampaignService, CampaignRecord, CampaignTargetRecord } from './campaign.service';
import type { PublishJobRecord, PublishJobService } from './publish-job.service';

export interface PlatformStats {
  platform: 'youtube' | 'tiktok' | 'instagram';
  totalTargets: number;
  published: number;
  failed: number;
  successRate: number;
  retriedTargets: number;
  topRetryDestination: string | null;
}

export interface DestinationStats {
  destinationId: string;
  destinationLabel: string | null;
  platform: 'youtube' | 'tiktok' | 'instagram';
  totalTargets: number;
  published: number;
  failed: number;
  successRate: number;
  retriedCount: number;
  latestFailureMessage: string | null;
}

export interface ChannelStats {
  channelId: string;
  totalTargets: number;
  published: number;
  failed: number;
  successRate: number;
  totalViews: number;
  topVideoId: string | null;
  topVideoTitle: string | null;
  topVideoViews: number;
}

interface DashboardVideoStats {
  videoId: string;
  title: string | null;
  views: number;
}

export type FailedJobSuggestedAction = 'retry' | 'reauth' | 'review';

export interface FailedJobDashboardItem {
  jobId: string | null;
  campaignId: string;
  campaignTitle: string;
  targetId: string;
  platform: CampaignTargetRecord['platform'];
  destinationId: string;
  destinationLabel: string | null;
  videoTitle: string;
  errorMessage: string;
  errorClass: PublishJobRecord['errorClass'];
  attempt: number | null;
  failedAt: string | null;
  suggestedAction: FailedJobSuggestedAction;
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
  failedJobs: FailedJobDashboardItem[];
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
  platformStats: PlatformStats[];
  destinationStats: DestinationStats[];
}

export interface DashboardServiceOptions {
  campaignService: CampaignService;
  jobService: PublishJobService;
  auditService?: AuditEventService;
  getAccessTokenForChannel?: (channelId: string) => Promise<string>;
  fetchVideoStats?: (accessToken: string, videoIds: string[]) => Promise<DashboardVideoStats[]>;
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
  private readonly getAccessTokenForChannel?: (channelId: string) => Promise<string>;
  private readonly fetchVideoStatsFn?: (accessToken: string, videoIds: string[]) => Promise<DashboardVideoStats[]>;

  constructor(options: DashboardServiceOptions) {
    this.campaignService = options.campaignService;
    this.jobService = options.jobService;
    this.auditService = options.auditService;
    this.getAccessTokenForChannel = options.getAccessTokenForChannel;
    this.fetchVideoStatsFn = options.fetchVideoStats ?? defaultFetchVideoStats;
  }

  private async loadVideoStatsByChannel(
    publishedTargets: Array<Pick<CampaignTargetRecord, 'channelId' | 'youtubeVideoId'>>,
  ): Promise<Map<string, Map<string, DashboardVideoStats>>> {
    const statsByChannel = new Map<string, Map<string, DashboardVideoStats>>();
    if (!this.getAccessTokenForChannel || !this.fetchVideoStatsFn || publishedTargets.length === 0) {
      return statsByChannel;
    }

    const videoIdsByChannel = new Map<string, Set<string>>();
    for (const target of publishedTargets) {
      if (!target.channelId || !target.youtubeVideoId) {
        continue;
      }
      if (!videoIdsByChannel.has(target.channelId)) {
        videoIdsByChannel.set(target.channelId, new Set());
      }
      videoIdsByChannel.get(target.channelId)!.add(target.youtubeVideoId);
    }

    await Promise.all(
      [...videoIdsByChannel.entries()].map(async ([channelId, videoIdSet]) => {
        const videoIds = [...videoIdSet];
        if (videoIds.length === 0) {
          return;
        }

        try {
          const accessToken = await this.getAccessTokenForChannel!(channelId);
          const channelStats = new Map<string, DashboardVideoStats>();
          for (let index = 0; index < videoIds.length; index += 50) {
            const chunk = videoIds.slice(index, index + 50);
            const stats = await this.fetchVideoStatsFn!(accessToken, chunk);
            for (const stat of stats) {
              channelStats.set(stat.videoId, stat);
            }
          }
          if (channelStats.size > 0) {
            statsByChannel.set(channelId, channelStats);
          }
        } catch {
          // Swallow per-channel stats failures to keep dashboard available.
        }
      }),
    );

    return statsByChannel;
  }

  private getTargetDashboardDestinationKey(
    target: Pick<CampaignTargetRecord, 'platform' | 'channelId' | 'destinationId' | 'destinationLabel' | 'connectedAccountId'>,
  ): string {
    return target.channelId ??
      target.destinationLabel ??
      target.destinationId ??
      target.connectedAccountId ??
      target.platform ??
      'unknown-destination';
  }

  private isTerminalTarget(target: Pick<CampaignTargetRecord, 'status' | 'youtubeVideoId' | 'externalPublishId' | 'errorMessage'>): boolean {
    return (target.status === 'publicado' && Boolean(target.youtubeVideoId ?? target.externalPublishId)) ||
      (target.status === 'erro' && Boolean(target.errorMessage));
  }

  private resolveEffectiveCampaignStatus(
    campaign: CampaignRecord,
    jobsByTargetId: Map<string, PublishJobRecord[]>,
  ): CampaignRecord['status'] {
    if (campaign.targets.length === 0) {
      return campaign.status;
    }

    const allTargetsTerminal = campaign.targets.every((target) => this.isTerminalTarget(target));
    if (allTargetsTerminal) {
      return campaign.targets.some((target) => target.status === 'publicado' && Boolean(target.youtubeVideoId ?? target.externalPublishId))
        ? 'completed'
        : 'failed';
    }

    const hasActiveJobs = campaign.targets.some((target) => {
      const jobs = jobsByTargetId.get(target.id) ?? [];
      const latestJob = jobs[jobs.length - 1];
      return latestJob?.status === 'queued' || latestJob?.status === 'processing';
    });
    if (hasActiveJobs) {
      return 'launching';
    }

    const hasInFlightTargets = campaign.targets.some((target) => target.status === 'enviando');
    if (hasInFlightTargets) {
      return 'launching';
    }

    return campaign.status;
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

  private buildFailedJobQueue(
    campaigns: CampaignRecord[],
    jobsByTargetId: Map<string, PublishJobRecord[]>,
  ): FailedJobDashboardItem[] {
    const items = campaigns.flatMap((campaign) =>
      campaign.targets
        .map((target): FailedJobDashboardItem | null => {
          const targetJobs = jobsByTargetId.get(target.id) ?? [];
          const latestFailedJob = [...targetJobs].reverse().find((job) => job.status === 'failed') ?? null;
          if (target.status !== 'erro' && !latestFailedJob) {
            return null;
          }

          const errorMessage = target.errorMessage ?? latestFailedJob?.errorMessage ?? 'Unknown publish failure';
          const suggestedAction: FailedJobSuggestedAction = errorMessage === 'REAUTH_REQUIRED'
            ? 'reauth'
            : latestFailedJob && latestFailedJob.errorClass !== 'permanent'
              ? 'retry'
              : 'review';
          const destinationId = target.destinationId ?? target.channelId ?? target.connectedAccountId ?? target.id;

          return {
            jobId: latestFailedJob?.id ?? null,
            campaignId: campaign.id,
            campaignTitle: campaign.title,
            targetId: target.id,
            platform: target.platform,
            destinationId,
            destinationLabel: target.destinationLabel ?? null,
            videoTitle: target.videoTitle,
            errorMessage,
            errorClass: latestFailedJob?.errorClass ?? null,
            attempt: latestFailedJob?.attempt ?? null,
            failedAt: latestFailedJob?.completedAt ?? latestFailedJob?.startedAt ?? latestFailedJob?.createdAt ?? null,
            suggestedAction,
          };
        })
        .filter((item): item is FailedJobDashboardItem => item !== null),
    );

    return items
      .sort((a, b) => {
        const aTime = a.failedAt ? Date.parse(a.failedAt) || 0 : 0;
        const bTime = b.failedAt ? Date.parse(b.failedAt) || 0 : 0;
        return bTime - aTime || a.campaignTitle.localeCompare(b.campaignTitle) || a.targetId.localeCompare(b.targetId);
      })
      .slice(0, 10);
  }

  async getStats(ownerEmail?: string): Promise<DashboardStats> {
    const { campaigns } = await this.campaignService.listCampaigns({ ownerEmail });
    const allJobs = await this.jobService.getAllJobs();
    const auditEvents = this.auditService
      ? await this.auditService.listEvents()
      : [];
    const scopedAuditEvents = ownerEmail
      ? auditEvents.filter((event) => campaigns.some((campaign) => campaign.id === event.campaignId))
      : auditEvents;
    const jobsByTargetId = new Map<string, PublishJobRecord[]>();
    for (const job of allJobs) {
      const existing = jobsByTargetId.get(job.campaignTargetId) ?? [];
      existing.push(job);
      jobsByTargetId.set(job.campaignTargetId, existing);
    }

    // Campaign breakdown
    const campaignByStatus: Record<CampaignRecord['status'], number> = {
      draft: 0, ready: 0, launching: 0, completed: 0, failed: 0,
    };
    for (const c of campaigns) {
      const effectiveStatus = this.resolveEffectiveCampaignStatus(c, jobsByTargetId);
      campaignByStatus[effectiveStatus]++;
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
    const reauthChannelIds = [...new Set(reauthTargets.map((target) => this.getTargetDashboardDestinationKey(target)))].sort();
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

      const dashboardDestinationKey = this.getTargetDashboardDestinationKey(t);
      if (!channelMap.has(dashboardDestinationKey)) {
        channelMap.set(dashboardDestinationKey, { total: 0, published: 0, failed: 0 });
      }
      const ch = channelMap.get(dashboardDestinationKey)!;
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
          const dashboardDestinationKey = this.getTargetDashboardDestinationKey(target);
          retryCountsByChannel.set(
            dashboardDestinationKey,
            (retryCountsByChannel.get(dashboardDestinationKey) ?? 0) + retryCount,
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
    for (const event of scopedAuditEvents) {
      auditByType[event.eventType] += 1;
    }
    const latestAuditEvent = scopedAuditEvents[0] ?? null;

    const publishedTargets = allTargets.filter((target) => target.status === 'publicado' && Boolean(target.youtubeVideoId));
    const videoStatsByChannel = await this.loadVideoStatsByChannel(
      publishedTargets.map((target) => ({
        channelId: target.channelId,
        youtubeVideoId: target.youtubeVideoId,
      })),
    );

    // Channel stats
    const channels: ChannelStats[] = [];
    for (const [channelId, data] of channelMap) {
      const termTotal = data.published + data.failed;
      const channelVideoStats = videoStatsByChannel.get(channelId);
      let totalViews = 0;
      let topVideoId: string | null = null;
      let topVideoTitle: string | null = null;
      let topVideoViews = 0;
      if (channelVideoStats) {
        for (const stat of channelVideoStats.values()) {
          totalViews += stat.views;
          if (stat.views > topVideoViews) {
            topVideoViews = stat.views;
            topVideoId = stat.videoId;
            topVideoTitle = stat.title;
          }
        }
      }
      channels.push({
        channelId,
        totalTargets: data.total,
        published: data.published,
        failed: data.failed,
        successRate: termTotal > 0 ? Math.round((data.published / termTotal) * 10000) / 100 : 0,
        totalViews,
        topVideoId,
        topVideoTitle,
        topVideoViews,
      });
    }

    // Platform stats aggregation
    const platformMap = new Map<string, { total: number; published: number; failed: number; retriedCount: number; destCounts: Map<string, number> }>();
    for (const target of allTargets) {
      const platform = (target.platform ?? 'youtube') as 'youtube' | 'tiktok' | 'instagram';
      if (!platformMap.has(platform)) {
        platformMap.set(platform, { total: 0, published: 0, failed: 0, retriedCount: 0, destCounts: new Map() });
      }
      const p = platformMap.get(platform)!;
      p.total++;
      if (target.status === 'publicado') p.published++;
      if (target.status === 'erro') p.failed++;

      // Track retry counts per destination within platform
      const targetJobs = jobsByTargetId.get(target.id) ?? [];
      for (const job of targetJobs) {
        if (job.attempt > 1) {
          const destId = target.destinationId || target.channelId || target.id;
          p.destCounts.set(destId, (p.destCounts.get(destId) ?? 0) + (job.attempt - 1));
        }
      }
    }

    const platformStats: PlatformStats[] = [];
    for (const [platform, data] of platformMap) {
      const termTotal = data.published + data.failed;
      const successRate = termTotal > 0 ? Math.round((data.published / termTotal) * 10000) / 100 : 0;

      // Find top retry destination for this platform
      let topRetryDestination: string | null = null;
      let topRetryCount = 0;
      for (const [destId, count] of data.destCounts) {
        if (count > topRetryCount) {
          topRetryCount = count;
          topRetryDestination = destId;
        }
      }

      platformStats.push({
        platform: platform as 'youtube' | 'tiktok' | 'instagram',
        totalTargets: data.total,
        published: data.published,
        failed: data.failed,
        successRate,
        retriedTargets: data.destCounts.size,
        topRetryDestination,
      });
    }

    // Sort platform stats by published count descending
    platformStats.sort((a, b) => b.published - a.published || a.platform.localeCompare(b.platform));

    // Destination stats aggregation
    const destinationMap = new Map<string, {
      platform: string;
      label: string | null;
      total: number;
      published: number;
      failed: number;
      retriedCount: number;
      latestFailureMessage: string | null;
    }>();

    for (const target of allTargets) {
      const destId = target.destinationId || target.channelId || target.id;
      const key = `${target.platform || 'youtube'}:${destId}`;

      if (!destinationMap.has(key)) {
        destinationMap.set(key, {
          platform: target.platform || 'youtube',
          label: target.destinationLabel || null,
          total: 0,
          published: 0,
          failed: 0,
          retriedCount: 0,
          latestFailureMessage: null,
        });
      }

      const dest = destinationMap.get(key)!;
      dest.total++;
      if (target.status === 'publicado') dest.published++;
      if (target.status === 'erro') {
        dest.failed++;
        if (!dest.latestFailureMessage) {
          dest.latestFailureMessage = target.errorMessage || null;
        }
      }

      // Count retries for this destination
      const targetJobs = jobsByTargetId.get(target.id) ?? [];
      for (const job of targetJobs) {
        if (job.attempt > 1) {
          dest.retriedCount += (job.attempt - 1);
        }
      }
    }

    const destinationStats: DestinationStats[] = [];
    for (const [key, data] of destinationMap) {
      const [platform, destId] = key.split(':');
      const termTotal = data.published + data.failed;
      const successRate = termTotal > 0 ? Math.round((data.published / termTotal) * 10000) / 100 : 0;

      destinationStats.push({
        destinationId: destId,
        destinationLabel: data.label,
        platform: data.platform as 'youtube' | 'tiktok' | 'instagram',
        totalTargets: data.total,
        published: data.published,
        failed: data.failed,
        successRate,
        retriedCount: data.retriedCount,
        latestFailureMessage: data.latestFailureMessage,
      });
    }

    // Sort destination stats by published count descending, limit to top 20
    destinationStats.sort((a, b) => b.published - a.published || a.destinationId.localeCompare(b.destinationId));
    const topDestinationStats = destinationStats.slice(0, 20);

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
      failedJobs: this.buildFailedJobQueue(campaigns, jobsByTargetId),
      retries: {
        retriedTargets,
        highestAttempt,
        hotspotChannelId,
        hotspotRetryCount,
      },
      audit: {
        totalEvents: scopedAuditEvents.length,
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
      platformStats,
      destinationStats: topDestinationStats,
    };
  }
}

async function defaultFetchVideoStats(accessToken: string, videoIds: string[]): Promise<DashboardVideoStats[]> {
  if (videoIds.length === 0) {
    return [];
  }

  const { google } = await import('googleapis');
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: accessToken });

  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
  const response = await youtube.videos.list({
    part: ['snippet', 'statistics'],
    id: videoIds,
    maxResults: 50,
  });

  const items = response.data.items ?? [];
  return items
    .map((item): DashboardVideoStats | null => {
      const videoId = item.id ?? null;
      if (!videoId) {
        return null;
      }

      const viewsRaw = item.statistics?.viewCount;
      const parsedViews = typeof viewsRaw === 'string'
        ? Number.parseInt(viewsRaw, 10)
        : typeof viewsRaw === 'number'
          ? viewsRaw
          : 0;
      const views = Number.isFinite(parsedViews) && parsedViews > 0 ? parsedViews : 0;

      return {
        videoId,
        title: item.snippet?.title ?? null,
        views,
      };
    })
    .filter((entry): entry is DashboardVideoStats => entry !== null);
}
