export interface ChannelLeaderboardRow {
  channelId: string;
  totalTargets: number;
  published: number;
  failed: number;
  successRate: number;
}

export interface SummaryCard {
  label: string;
  value: number | string;
}

export interface CampaignStatusBreakdown {
  status: string;
  count: number;
}

export interface DashboardData {
  campaigns: {
    total: number;
    byStatus: Record<string, number>;
  };
  targets: {
    total: number;
    byStatus: Record<string, number>;
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
    byType: {
      launch_campaign: number;
      retry_target: number;
      mark_ready: number;
      clone_campaign: number;
      delete_campaign: number;
      update_campaign: number;
      remove_target: number;
      update_target: number;
      add_target: number;
      add_targets_bulk: number;
      publish_completed: number;
      publish_failed: number;
      publish_partial_failure: number;
    };
    lastEventAt: string | null;
    lastEventType: 'launch_campaign' | 'retry_target' | 'mark_ready' | 'clone_campaign' | 'delete_campaign' | 'update_campaign' | 'remove_target' | 'update_target' | 'add_target' | 'add_targets_bulk' | 'publish_completed' | 'publish_failed' | 'publish_partial_failure' | null;
    lastActorEmail: string | null;
  };
  reauth: {
    blockedCampaigns: number;
    blockedTargets: number;
    blockedChannelCount: number;
    blockedChannelIds: string[];
  };
  channels: {
    channelId: string;
    totalTargets: number;
    published: number;
    failed: number;
    successRate: number;
  }[];
}

export interface DashboardView {
  summaryCards: SummaryCard[];
  campaignBreakdown: CampaignStatusBreakdown[];
  channelLeaderboard: ChannelLeaderboardRow[];
  quotaSummary: {
    dailyLimitUnits: number;
    estimatedConsumedUnits: number;
    estimatedQueuedUnits: number;
    estimatedProjectedUnits: number;
    estimatedRemainingUnits: number;
    usagePercent: number;
    projectedPercent: number;
    warningState: 'healthy' | 'warning' | 'critical';
  };
  quotaBanner?: {
    tone: 'warning' | 'error';
    title: string;
    body: string;
    dailyLimitUnits: number;
    estimatedConsumedUnits: number;
    estimatedQueuedUnits: number;
    estimatedProjectedUnits: number;
    estimatedRemainingUnits: number;
    usagePercent: number;
    projectedPercent: number;
    warningState: 'warning' | 'critical';
    primaryAction: {
      kind: 'review_campaigns';
      href: '/workspace/campanhas';
    };
  };
  failureSummary?: {
    failedCampaigns: number;
    failedTargets: number;
    topReason: 'quota_exceeded' | 'post_upload_step_failed' | 'other_failure';
    topReasonLabel: string;
    reasons: Array<{
      reason: 'quota_exceeded' | 'post_upload_step_failed' | 'other_failure';
      label: string;
      count: number;
    }>;
    primaryAction: {
      kind: 'review_campaigns';
      href: '/workspace/campanhas';
    };
  };
  failureBanner?: {
    tone: 'warning';
    title: string;
    body: string;
    failedCampaigns: number;
    failedTargets: number;
    topReason: 'quota_exceeded' | 'post_upload_step_failed' | 'other_failure';
    topReasonLabel: string;
    reasons: Array<{
      reason: 'quota_exceeded' | 'post_upload_step_failed' | 'other_failure';
      label: string;
      count: number;
    }>;
    primaryAction: {
      kind: 'review_campaigns';
      href: '/workspace/campanhas';
    };
  };
  retrySummary?: {
    totalRetries: number;
    retriedTargets: number;
    highestAttempt: number;
    hotspotChannelId: string;
    hotspotRetryCount: number;
    primaryAction: {
      kind: 'review_campaigns';
      href: '/workspace/campanhas';
    };
  };
  retryBanner?: {
    tone: 'warning';
    title: string;
    body: string;
    totalRetries: number;
    retriedTargets: number;
    highestAttempt: number;
    hotspotChannelId: string;
    hotspotRetryCount: number;
    primaryAction: {
      kind: 'review_campaigns';
      href: '/workspace/campanhas';
    };
  };
  auditSummary?: {
    totalEvents: number;
    launchCampaigns: number;
    retryTargets: number;
    markReadyCampaigns: number;
    clonedCampaigns: number;
    deletedCampaigns: number;
    updatedCampaigns: number;
    removedTargets: number;
    updatedTargets: number;
    addedTargets: number;
    bulkTargetAdds: number;
    completedPublishes: number;
    failedPublishes: number;
    partialFailedPublishes: number;
    lastEventAt: string;
    lastEventType: 'launch_campaign' | 'retry_target' | 'mark_ready' | 'clone_campaign' | 'delete_campaign' | 'update_campaign' | 'remove_target' | 'update_target' | 'add_target' | 'add_targets_bulk' | 'publish_completed' | 'publish_failed' | 'publish_partial_failure';
    lastActorEmail: string | null;
    primaryAction: {
      kind: 'review_campaigns';
      href: '/workspace/campanhas';
    };
  };
  auditBanner?: {
    tone: 'neutral';
    title: string;
    body: string;
    totalEvents: number;
    launchCampaigns: number;
    retryTargets: number;
    markReadyCampaigns: number;
    clonedCampaigns: number;
    deletedCampaigns: number;
    updatedCampaigns: number;
    removedTargets: number;
    updatedTargets: number;
    addedTargets: number;
    bulkTargetAdds: number;
    completedPublishes: number;
    failedPublishes: number;
    partialFailedPublishes: number;
    lastEventAt: string;
    lastEventType: 'launch_campaign' | 'retry_target' | 'mark_ready' | 'clone_campaign' | 'delete_campaign' | 'update_campaign' | 'remove_target' | 'update_target' | 'add_target' | 'add_targets_bulk' | 'publish_completed' | 'publish_failed' | 'publish_partial_failure';
    lastActorEmail: string | null;
    primaryAction: {
      kind: 'review_campaigns';
      href: '/workspace/campanhas';
    };
  };
  reauthSummary?: {
    blockedCampaigns: number;
    blockedTargets: number;
    blockedChannelCount: number;
    blockedChannelIds: string[];
    primaryAction: {
      kind: 'reauth_accounts';
      href: '/workspace/accounts';
    };
  };
  reauthBanner?: {
    tone: 'warning';
    title: string;
    body: string;
    blockedCampaigns: number;
    blockedTargets: number;
    blockedChannelCount: number;
    blockedChannelIds: string[];
    primaryAction: {
      kind: 'reauth_accounts';
      href: '/workspace/accounts';
    };
  };
  isEmpty: boolean;
}

const CAMPAIGN_STATUSES = ['draft', 'ready', 'launching', 'completed', 'failed'] as const;

function formatFailureReasonLabel(reason: 'quota_exceeded' | 'post_upload_step_failed' | 'other_failure'): string {
  switch (reason) {
    case 'quota_exceeded':
      return 'Quota exceeded';
    case 'post_upload_step_failed':
      return 'Post-upload step failed';
    default:
      return 'Other failure';
  }
}

export function buildDashboardView(data: DashboardData): DashboardView {
  const summaryCards: SummaryCard[] = [
    { label: 'Total Campaigns', value: data.campaigns.total },
    { label: 'Published Videos', value: data.targets.byStatus.publicado ?? 0 },
    { label: 'Success Rate', value: `${data.targets.successRate}%` },
    { label: 'Failed Uploads', value: data.targets.byStatus.erro ?? 0 },
  ];

  const campaignBreakdown: CampaignStatusBreakdown[] = CAMPAIGN_STATUSES.map((status) => ({
    status,
    count: data.campaigns.byStatus[status] ?? 0,
  }));

  const channelLeaderboard: ChannelLeaderboardRow[] = [...data.channels]
    .sort((a, b) => b.published - a.published)
    .map((ch) => ({
      channelId: ch.channelId,
      totalTargets: ch.totalTargets,
      published: ch.published,
      failed: ch.failed,
      successRate: ch.successRate,
    }));

  const view: DashboardView = {
    summaryCards,
    campaignBreakdown,
    channelLeaderboard,
    quotaSummary: {
      dailyLimitUnits: data.quota.dailyLimitUnits,
      estimatedConsumedUnits: data.quota.estimatedConsumedUnits,
      estimatedQueuedUnits: data.quota.estimatedQueuedUnits,
      estimatedProjectedUnits: data.quota.estimatedProjectedUnits,
      estimatedRemainingUnits: data.quota.estimatedRemainingUnits,
      usagePercent: data.quota.usagePercent,
      projectedPercent: data.quota.projectedPercent,
      warningState: data.quota.warningState,
    },
    isEmpty: data.campaigns.total === 0,
  };

  if (data.quota.warningState !== 'healthy') {
    view.quotaBanner = {
      tone: data.quota.warningState === 'critical' ? 'error' : 'warning',
      title: data.quota.warningState === 'critical'
        ? 'Estimated quota usage is beyond the daily limit'
        : 'Estimated quota usage is approaching the daily limit',
      body: `Projected usage is ${data.quota.estimatedProjectedUnits} of ${data.quota.dailyLimitUnits} units, with ${data.quota.estimatedQueuedUnits} queued units still pending.`,
      dailyLimitUnits: data.quota.dailyLimitUnits,
      estimatedConsumedUnits: data.quota.estimatedConsumedUnits,
      estimatedQueuedUnits: data.quota.estimatedQueuedUnits,
      estimatedProjectedUnits: data.quota.estimatedProjectedUnits,
      estimatedRemainingUnits: data.quota.estimatedRemainingUnits,
      usagePercent: data.quota.usagePercent,
      projectedPercent: data.quota.projectedPercent,
      warningState: data.quota.warningState,
      primaryAction: {
        kind: 'review_campaigns',
        href: '/workspace/campanhas',
      },
    };
  }

  if (data.failures.failedTargets > 0 && data.failures.topReason) {
    const primaryAction = {
      kind: 'review_campaigns' as const,
      href: '/workspace/campanhas' as const,
    };
    const reasons = data.failures.reasons.map((entry) => ({
      reason: entry.reason,
      label: formatFailureReasonLabel(entry.reason),
      count: entry.count,
    }));
    const topReasonLabel = formatFailureReasonLabel(data.failures.topReason);

    view.failureSummary = {
      failedCampaigns: data.failures.failedCampaigns,
      failedTargets: data.failures.failedTargets,
      topReason: data.failures.topReason,
      topReasonLabel,
      reasons,
      primaryAction,
    };
    view.failureBanner = {
      tone: 'warning',
      title: `${topReasonLabel} is the most common failure reason`,
      body: `${data.failures.failedTargets} failed target${data.failures.failedTargets === 1 ? '' : 's'} across ${data.failures.failedCampaigns} campaign${data.failures.failedCampaigns === 1 ? '' : 's'} need review.`,
      failedCampaigns: data.failures.failedCampaigns,
      failedTargets: data.failures.failedTargets,
      topReason: data.failures.topReason,
      topReasonLabel,
      reasons,
      primaryAction,
    };
  }

  if (data.jobs.totalRetries > 0 && data.retries.hotspotChannelId) {
    const primaryAction = {
      kind: 'review_campaigns' as const,
      href: '/workspace/campanhas' as const,
    };

    view.retrySummary = {
      totalRetries: data.jobs.totalRetries,
      retriedTargets: data.retries.retriedTargets,
      highestAttempt: data.retries.highestAttempt,
      hotspotChannelId: data.retries.hotspotChannelId,
      hotspotRetryCount: data.retries.hotspotRetryCount,
      primaryAction,
    };
    view.retryBanner = {
      tone: 'warning',
      title: `Retries are concentrating on ${data.retries.hotspotChannelId}`,
      body: `${data.jobs.totalRetries} extra retry attempt${data.jobs.totalRetries === 1 ? ' is' : 's are'} spread across ${data.retries.retriedTargets} target${data.retries.retriedTargets === 1 ? '' : 's'}, with ${data.retries.hotspotRetryCount} on ${data.retries.hotspotChannelId}.`,
      totalRetries: data.jobs.totalRetries,
      retriedTargets: data.retries.retriedTargets,
      highestAttempt: data.retries.highestAttempt,
      hotspotChannelId: data.retries.hotspotChannelId,
      hotspotRetryCount: data.retries.hotspotRetryCount,
      primaryAction,
    };
  }

  if (data.audit.totalEvents > 0 && data.audit.lastEventAt && data.audit.lastEventType) {
    const primaryAction = {
      kind: 'review_campaigns' as const,
      href: '/workspace/campanhas' as const,
    };

    view.auditSummary = {
      totalEvents: data.audit.totalEvents,
      launchCampaigns: data.audit.byType.launch_campaign,
      retryTargets: data.audit.byType.retry_target,
      markReadyCampaigns: data.audit.byType.mark_ready,
      clonedCampaigns: data.audit.byType.clone_campaign,
      deletedCampaigns: data.audit.byType.delete_campaign,
      updatedCampaigns: data.audit.byType.update_campaign,
      removedTargets: data.audit.byType.remove_target,
      updatedTargets: data.audit.byType.update_target,
      addedTargets: data.audit.byType.add_target,
      bulkTargetAdds: data.audit.byType.add_targets_bulk,
      completedPublishes: data.audit.byType.publish_completed,
      failedPublishes: data.audit.byType.publish_failed,
      partialFailedPublishes: data.audit.byType.publish_partial_failure,
      lastEventAt: data.audit.lastEventAt,
      lastEventType: data.audit.lastEventType,
      lastActorEmail: data.audit.lastActorEmail,
      primaryAction,
    };
    view.auditBanner = {
      tone: 'neutral',
      title: 'Campaign activity is being recorded',
      body: `${data.audit.totalEvents} campaign actions have been recorded. Latest action: ${data.audit.lastEventType}${data.audit.lastActorEmail ? ` by ${data.audit.lastActorEmail}` : ''}.`,
      totalEvents: data.audit.totalEvents,
      launchCampaigns: data.audit.byType.launch_campaign,
      retryTargets: data.audit.byType.retry_target,
      markReadyCampaigns: data.audit.byType.mark_ready,
      clonedCampaigns: data.audit.byType.clone_campaign,
      deletedCampaigns: data.audit.byType.delete_campaign,
      updatedCampaigns: data.audit.byType.update_campaign,
      removedTargets: data.audit.byType.remove_target,
      updatedTargets: data.audit.byType.update_target,
      addedTargets: data.audit.byType.add_target,
      bulkTargetAdds: data.audit.byType.add_targets_bulk,
      completedPublishes: data.audit.byType.publish_completed,
      failedPublishes: data.audit.byType.publish_failed,
      partialFailedPublishes: data.audit.byType.publish_partial_failure,
      lastEventAt: data.audit.lastEventAt,
      lastEventType: data.audit.lastEventType,
      lastActorEmail: data.audit.lastActorEmail,
      primaryAction,
    };
  }

  if (data.reauth.blockedTargets > 0) {
    const primaryAction = {
      kind: 'reauth_accounts' as const,
      href: '/workspace/accounts' as const,
    };

    view.reauthSummary = {
      blockedCampaigns: data.reauth.blockedCampaigns,
      blockedTargets: data.reauth.blockedTargets,
      blockedChannelCount: data.reauth.blockedChannelCount,
      blockedChannelIds: data.reauth.blockedChannelIds,
      primaryAction,
    };
    view.reauthBanner = {
      tone: 'warning',
      title: 'Reconnect required for blocked campaigns',
      body: `${data.reauth.blockedCampaigns} campaign${data.reauth.blockedCampaigns === 1 ? '' : 's'} include ${data.reauth.blockedTargets} target${data.reauth.blockedTargets === 1 ? '' : 's'} blocked by account reauthorization across ${data.reauth.blockedChannelCount} channel${data.reauth.blockedChannelCount === 1 ? '' : 's'}.`,
      blockedCampaigns: data.reauth.blockedCampaigns,
      blockedTargets: data.reauth.blockedTargets,
      blockedChannelCount: data.reauth.blockedChannelCount,
      blockedChannelIds: data.reauth.blockedChannelIds,
      primaryAction,
    };
  }

  return view;
}
