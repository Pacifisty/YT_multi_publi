import type { AuthFetch } from '../../../../../lib/auth-client';
import { buildCampaignDetailPage, type CampaignDetailActivityEntry, type CampaignDetailAuditSummary, type CampaignDetailAuditTimelineEntry, type CampaignDetailPageView } from '../detail-page';

type CampaignDetailRouteSearchParams = Record<string, string | string[] | undefined>;

type CampaignDetailRouteActivityEntry = CampaignDetailActivityEntry & {
  targetHistoryHref?: string;
};

type CampaignDetailActivityFilterKind = 'all' | 'jobs' | 'audit' | 'target';

export interface CampaignDetailActivityFilterOption {
  key: string;
  kind: CampaignDetailActivityFilterKind;
  label: string;
  count: number;
  href: string;
  active: boolean;
  targetId?: string;
}

export interface CampaignDetailActivityFiltersView {
  selected: CampaignDetailActivityFilterOption;
  options: CampaignDetailActivityFilterOption[];
  filteredSummary: {
    totalEvents: number;
    jobEvents: number;
    auditEvents: number;
    latestEventAt: string;
  };
  filteredTimeline: CampaignDetailRouteActivityEntry[];
}

export interface CampaignDetailRouteView {
  route: string;
  backHref: '/workspace/campanhas';
  actions: {
    refreshHref: string;
    nextRefreshAt?: string;
    markReadyHref?: string;
    launchHref?: string;
    deleteHref?: string;
    cloneHref?: string;
  };
  summary?: {
    totalTargets: number;
    retryAvailableCount: number;
    postUploadWarningCount: number;
    targetsWithHistoryCount: number;
    manualAttentionCount: number;
    inProgressCount: number;
  };
  targetActions?: Array<{
    targetId: string;
    historyHref: string;
    retryHref?: string;
    reviewHref?: string;
    reauthHref?: string;
  }>;
  targetHistorySummary?: Array<{
    targetId: string;
    latestJobId: string;
    latestJobStatus: 'queued' | 'processing' | 'completed' | 'failed';
    latestAttempt: number;
    latestStartedAt: string | null;
    latestCompletedAt: string | null;
  }>;
  latestExecutionSummary?: {
    targetId: string;
    latestJobId: string;
    latestJobStatus: 'queued' | 'processing' | 'completed' | 'failed';
    latestAttempt: number;
    latestStartedAt: string | null;
    latestCompletedAt: string | null;
  };
  latestFailedExecutionSummary?: {
    targetId: string;
    latestJobId: string;
    latestJobStatus: 'failed';
    latestAttempt: number;
    latestStartedAt: string | null;
    latestCompletedAt: string | null;
    errorMessage: string | null;
  };
  latestSuccessfulExecutionSummary?: {
    targetId: string;
    latestJobId: string;
    latestJobStatus: 'completed';
    latestAttempt: number;
    latestStartedAt: string | null;
    latestCompletedAt: string | null;
    youtubeVideoId: string | null;
  };
  operationalOverview?: {
    lifecycleState?: 'draft' | 'ready' | 'launching' | 'failed' | 'completed';
    latestExecution?: CampaignDetailRouteView['latestExecutionSummary'];
    latestFailure?: CampaignDetailRouteView['latestFailedExecutionSummary'];
    latestSuccess?: CampaignDetailRouteView['latestSuccessfulExecutionSummary'];
    primaryAction?: CampaignDetailRouteView['recommendedActions'] extends Array<infer Item> ? Item : never;
    secondaryAction?: CampaignDetailRouteView['recommendedActions'] extends Array<infer Item> ? Item : never;
    dominantAttentionReason?: 'review_required' | 'retry_available' | 'manual_attention' | 'in_progress' | 'scheduled';
    attentionCounts?: {
      review_required: number;
      retry_available: number;
      manual_attention: number;
      in_progress: number;
    };
    attentionTargets?: {
      review_required: string[];
      retry_available: string[];
      manual_attention: string[];
      in_progress: string[];
    };
    attentionState?: 'needs_review' | 'retry_available' | 'manual_attention' | 'in_progress' | 'scheduled' | 'stable';
    scheduledCount?: number;
    scheduledTargetIds?: string[];
    nextScheduledAt?: string;
  };
  statusBanner?: {
    kind: 'draft' | 'ready' | 'in_progress' | 'scheduled' | 'needs_review' | 'retry_available' | 'manual_attention' | 'stable';
    tone: 'warning' | 'neutral' | 'success';
    title: string;
    body: string;
    targetCount: number;
    targetIds: string[];
    nextScheduledAt?: string;
    primaryAction?: CampaignDetailRouteView['recommendedActions'] extends Array<infer Item> ? Item : never;
    secondaryAction?: CampaignDetailRouteView['recommendedActions'] extends Array<infer Item> ? Item : never;
  };
  lastFailureSummary?: Array<{
    targetId: string;
    latestAttempt?: number;
    errorMessage: string;
  }>;
  priorityTargets?: Array<{
    targetId: string;
    reason: 'review_required' | 'retry_available' | 'manual_attention' | 'in_progress';
  }>;
  recommendedActions?: Array<{
    kind: 'review_partial_failure' | 'reauth_account' | 'retry_failed_target' | 'refresh_status' | 'launch_campaign' | 'mark_ready' | 'clone_campaign';
    targetId?: string;
    href: string;
  }>;
  auditSummary?: CampaignDetailAuditSummary;
  auditTimeline?: Array<CampaignDetailAuditTimelineEntry & {
    targetHistoryHref?: string;
  }>;
  activitySummary?: CampaignDetailPageView['activitySummary'];
  activityTimeline?: CampaignDetailRouteActivityEntry[];
  activityFilters?: CampaignDetailActivityFiltersView;
  page?: CampaignDetailPageView;
  errorState?: {
    heading: string;
    body: string;
    cta: string;
  };
}

function readCampaignDetailSearchParam(searchParams: CampaignDetailRouteSearchParams | undefined, key: string): string | undefined {
  const value = searchParams?.[key];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function buildCampaignDetailActivityFilterHref(
  route: string,
  filter: { activity?: 'jobs' | 'audit'; targetId?: string },
): string {
  const params = new URLSearchParams();
  if (filter.activity) {
    params.set('activity', filter.activity);
  }
  if (filter.targetId) {
    params.set('targetId', filter.targetId);
  }
  const query = params.toString();
  return query ? `${route}?${query}` : route;
}

function buildCampaignDetailActivityFiltersView(options: {
  route: string;
  timeline: CampaignDetailRouteActivityEntry[];
  searchParams?: CampaignDetailRouteSearchParams;
}): CampaignDetailActivityFiltersView | undefined {
  if (options.timeline.length === 0) {
    return undefined;
  }

  const jobEventCount = options.timeline.filter((entry) => entry.kind === 'job').length;
  const auditEventCount = options.timeline.length - jobEventCount;
  const targetEventCounts = new Map<string, number>();
  for (const entry of options.timeline) {
    if (!entry.targetId) {
      continue;
    }

    targetEventCounts.set(entry.targetId, (targetEventCounts.get(entry.targetId) ?? 0) + 1);
  }

  const requestedTargetId = readCampaignDetailSearchParam(options.searchParams, 'targetId');
  const requestedActivity = readCampaignDetailSearchParam(options.searchParams, 'activity')?.toLowerCase();

  let selectedFilterKind: CampaignDetailActivityFilterKind = 'all';
  let selectedTargetId: string | undefined;
  if (requestedTargetId && targetEventCounts.has(requestedTargetId)) {
    selectedFilterKind = 'target';
    selectedTargetId = requestedTargetId;
  } else if (requestedActivity === 'jobs' && jobEventCount > 0) {
    selectedFilterKind = 'jobs';
  } else if (requestedActivity === 'audit' && auditEventCount > 0) {
    selectedFilterKind = 'audit';
  }

  const activityFilters: CampaignDetailActivityFilterOption[] = [
    {
      key: 'all',
      kind: 'all',
      label: 'All activity',
      count: options.timeline.length,
      href: buildCampaignDetailActivityFilterHref(options.route, {}),
      active: selectedFilterKind === 'all',
    },
    {
      key: 'jobs',
      kind: 'jobs',
      label: 'Jobs',
      count: jobEventCount,
      href: buildCampaignDetailActivityFilterHref(options.route, { activity: 'jobs' }),
      active: selectedFilterKind === 'jobs',
    },
    {
      key: 'audit',
      kind: 'audit',
      label: 'Audit',
      count: auditEventCount,
      href: buildCampaignDetailActivityFilterHref(options.route, { activity: 'audit' }),
      active: selectedFilterKind === 'audit',
    },
    ...Array.from(targetEventCounts.entries()).map(([targetId, count]) => ({
      key: `target:${targetId}`,
      kind: 'target' as const,
      label: `Target ${targetId}`,
      count,
      href: buildCampaignDetailActivityFilterHref(options.route, { targetId }),
      active: selectedFilterKind === 'target' && selectedTargetId === targetId,
      targetId,
    })),
  ];

  const filteredTimeline = selectedFilterKind === 'jobs'
    ? options.timeline.filter((entry) => entry.kind === 'job')
    : selectedFilterKind === 'audit'
      ? options.timeline.filter((entry) => entry.kind === 'audit')
      : selectedFilterKind === 'target'
        ? options.timeline.filter((entry) => entry.targetId === selectedTargetId)
        : options.timeline;
  const filteredJobEvents = filteredTimeline.filter((entry) => entry.kind === 'job').length;
  const filteredAuditEvents = filteredTimeline.length - filteredJobEvents;
  const selectedFilter = activityFilters.find((filter) => filter.active) ?? activityFilters[0];
  const [latestFilteredEvent] = filteredTimeline;
  if (!latestFilteredEvent) {
    return undefined;
  }

  return {
    selected: selectedFilter,
    options: activityFilters,
    filteredSummary: {
      totalEvents: filteredTimeline.length,
      jobEvents: filteredJobEvents,
      auditEvents: filteredAuditEvents,
      latestEventAt: latestFilteredEvent.timestamp,
    },
    filteredTimeline,
  };
}

export async function buildCampaignDetailRoute(options: {
  params: { campaignId: string };
  searchParams?: CampaignDetailRouteSearchParams;
  fetcher?: AuthFetch;
  now?: () => Date;
}): Promise<CampaignDetailRouteView> {
  const result = await buildCampaignDetailPage({
    campaignId: options.params.campaignId,
    fetcher: options.fetcher,
    now: options.now,
  });

  const view: CampaignDetailRouteView = {
    route: `/workspace/campanhas/${options.params.campaignId}`,
    backHref: '/workspace/campanhas',
    actions: {
      refreshHref: `/api/campaigns/${options.params.campaignId}/status`,
      markReadyHref: undefined,
      launchHref: undefined,
      cloneHref: undefined,
    },
  };

  if (result.error) {
    view.errorState = {
      heading: 'Campaign unavailable',
      body: result.error,
      cta: 'Back to campaigns',
    };
    return view;
  }

  view.page = result.page;
  view.auditSummary = result.page?.auditSummary;
  view.auditTimeline = result.page?.auditTimeline?.map((event) => ({
    ...event,
    targetHistoryHref: event.targetId
      ? `/api/campaigns/${options.params.campaignId}/targets/${event.targetId}/jobs`
      : undefined,
  }));
  view.activitySummary = result.page?.activitySummary;
  view.activityTimeline = result.page?.activityTimeline?.map((entry) => ({
    ...entry,
    targetHistoryHref: entry.targetId
      ? `/api/campaigns/${options.params.campaignId}/targets/${entry.targetId}/jobs`
      : undefined,
  }));
  view.activityFilters = buildCampaignDetailActivityFiltersView({
    route: view.route,
    timeline: view.activityTimeline ?? [],
    searchParams: options.searchParams,
  });
  view.actions.cloneHref = `/api/campaigns/${options.params.campaignId}/clone`;
  if (result.page?.polling.nextScheduledAt) {
    view.actions.nextRefreshAt = result.page.polling.nextScheduledAt;
  }
  if (result.page?.detail.header.status === 'draft' && (result.page?.detail.targets.length ?? 0) > 0) {
    view.actions.markReadyHref = `/api/campaigns/${options.params.campaignId}/ready`;
  }
  if (result.page?.detail.header.status === 'ready' && (result.page?.detail.targets.length ?? 0) > 0) {
    view.actions.launchHref = `/api/campaigns/${options.params.campaignId}/launch`;
  }
  if (result.page?.detail.header.status === 'draft' || result.page?.detail.header.status === 'ready') {
    view.actions.deleteHref = `/api/campaigns/${options.params.campaignId}`;
  }
  const processingTargetIds = result.page?.polling.enabled
    ? result.page?.detail.targets
      .filter((target) => target.status === 'enviando' || (target.status === 'aguardando' && !target.scheduledPending))
      .map((target) => target.id) ?? []
    : [];
  const scheduledTargetIds = result.page?.detail.targets
    .filter((target) => target.status === 'aguardando' && target.scheduledPending)
    .map((target) => target.id) ?? [];
  const manualAttentionTargetIds = result.page?.detail.targets
    .filter((target) => target.status === 'erro' && !target.partialFailureYoutubeUrl && !target.retryAvailable)
    .map((target) => target.id) ?? [];
  const reauthRequiredTargetIds = result.page?.detail.targets
    .filter((target) => target.reauthRequired)
    .map((target) => target.id) ?? [];
  const readyToLaunchTargetIds = result.page?.detail.header.status === 'ready'
    ? result.page?.detail.targets.map((target) => target.id) ?? []
    : [];
  const draftConfiguredTargetIds = result.page?.detail.header.status === 'draft'
    ? result.page?.detail.targets.map((target) => target.id) ?? []
    : [];
  const failedWithoutTargets = result.page?.detail.header.status === 'failed'
    && (result.page?.detail.targets.length ?? 0) === 0;

  view.summary = {
    totalTargets: result.page?.detail.targets.length ?? 0,
    retryAvailableCount: result.page?.detail.targets
      .filter((target) => Boolean(target.retryAvailable) && !target.partialFailureYoutubeUrl)
      .length ?? 0,
    postUploadWarningCount: result.page?.detail.targets.filter((target) => Boolean(target.partialFailureYoutubeUrl)).length ?? 0,
    targetsWithHistoryCount: result.page?.targetHistory?.length ?? 0,
    manualAttentionCount: manualAttentionTargetIds.length,
    inProgressCount: processingTargetIds.length,
  };
  view.targetActions = result.page?.detail.targets.map((target) => ({
    targetId: target.id,
    historyHref: `/api/campaigns/${options.params.campaignId}/targets/${target.id}/jobs`,
    retryHref: target.retryAvailable
      && !target.partialFailureYoutubeUrl
      ? `/api/campaigns/${options.params.campaignId}/targets/${target.id}/retry`
      : undefined,
    reviewHref: target.partialFailureYoutubeUrl,
    ...(target.reauthRequired
      ? { reauthHref: '/workspace/accounts' }
      : {}),
  }));
  view.targetHistorySummary = result.page?.targetHistory
    ?.map((entry) => {
      const latestJob = entry.jobs[entry.jobs.length - 1];
      if (!latestJob) {
        return null;
      }

      return {
        targetId: entry.targetId,
        latestJobId: latestJob.id,
        latestJobStatus: latestJob.status,
        latestAttempt: latestJob.attempt,
        latestStartedAt: latestJob.startedAt,
        latestCompletedAt: latestJob.completedAt,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  view.latestExecutionSummary = view.targetHistorySummary?.reduce<
    CampaignDetailRouteView['latestExecutionSummary']
  >((latest, entry) => {
    if (!latest) {
      return entry;
    }

    const latestTimestamp = latest.latestStartedAt ?? latest.latestCompletedAt ?? '';
    const entryTimestamp = entry.latestStartedAt ?? entry.latestCompletedAt ?? '';

    return entryTimestamp > latestTimestamp ? entry : latest;
  }, undefined);
  view.latestFailedExecutionSummary = result.page?.targetHistory
    ?.flatMap((entry) =>
      entry.jobs
        .filter((job) => job.status === 'failed')
        .map((job) => ({
          targetId: entry.targetId,
          latestJobId: job.id,
          latestJobStatus: job.status,
          latestAttempt: job.attempt,
          latestStartedAt: job.startedAt,
          latestCompletedAt: job.completedAt,
          errorMessage: job.errorMessage,
        })),
    )
    .reduce<CampaignDetailRouteView['latestFailedExecutionSummary']>((latest, entry) => {
      if (!latest) {
        return entry;
      }

      const latestTimestamp = latest.latestStartedAt ?? latest.latestCompletedAt ?? '';
      const entryTimestamp = entry.latestStartedAt ?? entry.latestCompletedAt ?? '';

      return entryTimestamp > latestTimestamp ? entry : latest;
    }, undefined);
  view.latestSuccessfulExecutionSummary = result.page?.targetHistory
    ?.flatMap((entry) =>
      entry.jobs
        .filter((job) => job.status === 'completed')
        .map((job) => ({
          targetId: entry.targetId,
          latestJobId: job.id,
          latestJobStatus: job.status,
          latestAttempt: job.attempt,
          latestStartedAt: job.startedAt,
          latestCompletedAt: job.completedAt,
          youtubeVideoId: job.youtubeVideoId,
        })),
    )
    .reduce<CampaignDetailRouteView['latestSuccessfulExecutionSummary']>((latest, entry) => {
      if (!latest) {
        return entry;
      }

      const latestTimestamp = latest.latestStartedAt ?? latest.latestCompletedAt ?? '';
      const entryTimestamp = entry.latestStartedAt ?? entry.latestCompletedAt ?? '';

      return entryTimestamp > latestTimestamp ? entry : latest;
    }, undefined);
  view.lastFailureSummary = result.page?.detail.targets
    .map((target) => {
      if (target.status !== 'erro' || !target.errorMessage) {
        return null;
      }

      const historyEntry = result.page?.targetHistory?.find((entry) => entry.targetId === target.id);
      const failedJob = historyEntry?.jobs
        .filter((job) => job.status === 'failed')
        .slice(-1)[0];

      return {
        targetId: target.id,
        latestAttempt: failedJob?.attempt,
        errorMessage: failedJob?.errorMessage ?? target.errorMessage,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  view.priorityTargets = [
    ...(result.page?.detail.targets
      .filter((target) => Boolean(target.partialFailureYoutubeUrl))
      .map((target) => ({
        targetId: target.id,
        reason: 'review_required' as const,
      })) ?? []),
    ...(result.page?.detail.targets
      .filter((target) => !target.partialFailureYoutubeUrl && Boolean(target.retryAvailable))
      .map((target) => ({
        targetId: target.id,
        reason: 'retry_available' as const,
      })) ?? []),
    ...(result.page?.detail.targets
      .filter((target) => target.status === 'erro' && !target.partialFailureYoutubeUrl && !target.retryAvailable)
      .map((target) => ({
        targetId: target.id,
        reason: 'manual_attention' as const,
      })) ?? []),
    ...(result.page?.polling.enabled
      ? result.page?.detail.targets
        .filter((target) => target.status === 'aguardando' || target.status === 'enviando')
        .map((target) => ({
          targetId: target.id,
          reason: 'in_progress' as const,
        })) ?? []
      : []),
  ];
  view.recommendedActions = [
    ...(view.targetActions
      ?.filter((target) => Boolean(target.reviewHref))
      .map((target) => ({
        kind: 'review_partial_failure' as const,
        targetId: target.targetId,
        href: target.reviewHref!,
      })) ?? []),
    ...(view.targetActions
      ?.filter((target) => Boolean(target.reauthHref))
      .map((target) => ({
        kind: 'reauth_account' as const,
        targetId: target.targetId,
        href: target.reauthHref!,
      })) ?? []),
    ...(view.targetActions
      ?.filter((target) => Boolean(target.retryHref) && !target.reviewHref && !target.reauthHref)
      .map((target) => ({
        kind: 'retry_failed_target' as const,
        targetId: target.targetId,
        href: target.retryHref!,
      })) ?? []),
  ];
  if (view.recommendedActions.length === 0) {
    if (draftConfiguredTargetIds.length > 0) {
      view.recommendedActions.push({
        kind: 'mark_ready',
        href: `/api/campaigns/${options.params.campaignId}/ready`,
      });
    } else if (readyToLaunchTargetIds.length > 0) {
      view.recommendedActions.push({
        kind: 'launch_campaign',
        href: `/api/campaigns/${options.params.campaignId}/launch`,
      });
    } else if (processingTargetIds.length > 0) {
      view.recommendedActions.push({
        kind: 'refresh_status',
        href: view.actions.refreshHref,
      });
    } else if (scheduledTargetIds.length > 0) {
      view.recommendedActions.push({
        kind: 'refresh_status',
        href: view.actions.refreshHref,
      });
    } else if (result.page?.detail.header.status === 'completed' && view.actions.cloneHref) {
      view.recommendedActions.push({
        kind: 'clone_campaign',
        href: view.actions.cloneHref,
      });
    }
  }
  if (
    view.latestExecutionSummary
    || view.latestFailedExecutionSummary
    || view.latestSuccessfulExecutionSummary
    || view.recommendedActions[0]
    || manualAttentionTargetIds.length > 0
    || processingTargetIds.length > 0
    || scheduledTargetIds.length > 0
    || failedWithoutTargets
    || result.page?.detail.header.status === 'draft'
    || readyToLaunchTargetIds.length > 0
    || (result.page?.detail.header.status === 'completed' && (result.page?.detail.targets.length ?? 0) > 0)
  ) {
    view.operationalOverview = {
      lifecycleState: result.page?.detail.header.status as CampaignDetailRouteView['operationalOverview']['lifecycleState'],
      latestExecution: view.latestExecutionSummary,
      latestFailure: view.latestFailedExecutionSummary,
      latestSuccess: view.latestSuccessfulExecutionSummary,
      primaryAction: view.recommendedActions[0],
      secondaryAction: view.recommendedActions[1],
      dominantAttentionReason: view.priorityTargets?.[0]?.reason
        ?? (manualAttentionTargetIds.length > 0
          || failedWithoutTargets
          ? 'manual_attention'
          : result.page?.polling.enabled && processingTargetIds.length > 0
            ? 'in_progress'
            : scheduledTargetIds.length > 0
              ? 'scheduled'
            : undefined),
      attentionCounts: {
        review_required: view.priorityTargets?.filter((target) => target.reason === 'review_required').length ?? 0,
        retry_available: view.priorityTargets?.filter((target) => target.reason === 'retry_available').length ?? 0,
        manual_attention: manualAttentionTargetIds.length,
        in_progress: processingTargetIds.length,
      },
      attentionTargets: {
        review_required: view.priorityTargets
          ?.filter((target) => target.reason === 'review_required')
          .map((target) => target.targetId) ?? [],
        retry_available: view.priorityTargets
          ?.filter((target) => target.reason === 'retry_available')
          .map((target) => target.targetId) ?? [],
        manual_attention: manualAttentionTargetIds,
        in_progress: processingTargetIds,
      },
      attentionState: view.priorityTargets?.[0]?.reason === 'review_required'
        ? 'needs_review'
        : view.priorityTargets?.[0]?.reason === 'retry_available'
          ? 'retry_available'
          : manualAttentionTargetIds.length > 0 || failedWithoutTargets
            ? 'manual_attention'
            : result.page?.polling.enabled && processingTargetIds.length > 0
              ? 'in_progress'
              : scheduledTargetIds.length > 0
                ? 'scheduled'
              : 'stable',
    };
    if (scheduledTargetIds.length > 0) {
      view.operationalOverview.scheduledCount = scheduledTargetIds.length;
      view.operationalOverview.scheduledTargetIds = scheduledTargetIds;
      view.operationalOverview.nextScheduledAt = result.page?.polling.nextScheduledAt ?? undefined;
    }
  }
  if (view.operationalOverview) {
    const reviewCount = view.operationalOverview.attentionCounts?.review_required ?? 0;
    const retryCount = view.operationalOverview.attentionCounts?.retry_available ?? 0;
    const manualAttentionCount = view.operationalOverview.attentionCounts?.manual_attention ?? 0;
    const inProgressCount = view.operationalOverview.attentionCounts?.in_progress ?? 0;

    if (view.operationalOverview.attentionState === 'needs_review') {
      view.statusBanner = {
        kind: 'needs_review',
        tone: 'warning',
        title: 'Campaign needs review',
        body: retryCount > 0
          ? `${reviewCount} target${reviewCount === 1 ? '' : 's'} needs review before retry actions.`
          : `${reviewCount} target${reviewCount === 1 ? '' : 's'} needs review.`,
        targetCount: view.operationalOverview.attentionTargets?.review_required.length ?? 0,
        targetIds: view.operationalOverview.attentionTargets?.review_required ?? [],
        primaryAction: view.operationalOverview.primaryAction,
        secondaryAction: view.operationalOverview.secondaryAction,
      };
    } else if (view.operationalOverview.attentionState === 'retry_available') {
      view.statusBanner = {
        kind: 'retry_available',
        tone: 'neutral',
        title: 'Campaign has retryable targets',
        body: `${retryCount} target${retryCount === 1 ? '' : 's'} can be retried now.`,
        targetCount: view.operationalOverview.attentionTargets?.retry_available.length ?? 0,
        targetIds: view.operationalOverview.attentionTargets?.retry_available ?? [],
        primaryAction: view.operationalOverview.primaryAction,
        secondaryAction: view.operationalOverview.secondaryAction,
      };
    } else if (view.operationalOverview.attentionState === 'manual_attention') {
      const reauthTargetCount = reauthRequiredTargetIds.length;
      view.statusBanner = {
        kind: 'manual_attention',
        tone: 'warning',
        title: failedWithoutTargets
          ? 'Campaign failed before processing targets'
          : reauthTargetCount > 0
            ? 'Campaign has targets requiring reauthorization'
            : 'Campaign has failed targets',
        body: failedWithoutTargets
          ? 'No targets were processed. Review campaign configuration or launch conditions before retrying.'
          : reauthTargetCount > 0
            ? `${reauthTargetCount} target${reauthTargetCount === 1 ? ' is' : 's are'} blocked until ${reauthTargetCount === 1 ? 'its connected account is' : 'their connected accounts are'} reauthorized.`
            : `${manualAttentionCount} target${manualAttentionCount === 1 ? '' : 's'} failed and needs manual attention.`,
        targetCount: failedWithoutTargets
          ? 0
          : reauthTargetCount > 0
            ? reauthTargetCount
            : manualAttentionCount,
        targetIds: failedWithoutTargets
          ? []
          : reauthTargetCount > 0
            ? reauthRequiredTargetIds
            : view.operationalOverview.attentionTargets?.manual_attention ?? [],
        primaryAction: reauthTargetCount > 0 ? view.operationalOverview.primaryAction : undefined,
        secondaryAction: reauthTargetCount > 0 ? view.operationalOverview.secondaryAction : undefined,
      };
    } else if (view.operationalOverview.attentionState === 'in_progress') {
      view.statusBanner = {
        kind: 'in_progress',
        tone: 'neutral',
        title: 'Campaign is in progress',
        body: `${inProgressCount} target${inProgressCount === 1 ? ' is' : 's are'} still processing.`,
        targetCount: inProgressCount,
        targetIds: view.operationalOverview.attentionTargets?.in_progress ?? [],
        primaryAction: view.operationalOverview.primaryAction,
        secondaryAction: undefined,
      };
    } else if (view.operationalOverview.attentionState === 'scheduled') {
      const scheduledCount = view.operationalOverview.scheduledCount ?? 0;
      view.statusBanner = {
        kind: 'scheduled',
        tone: 'neutral',
        title: 'Campaign has scheduled targets',
        body: `${scheduledCount} target${scheduledCount === 1 ? ' is' : 's are'} waiting for scheduled publish time.`,
        targetCount: scheduledCount,
        targetIds: view.operationalOverview.scheduledTargetIds ?? [],
        nextScheduledAt: view.operationalOverview.nextScheduledAt,
        primaryAction: view.operationalOverview.primaryAction,
        secondaryAction: undefined,
      };
    } else {
      const targetCount = result.page?.detail.targets.length ?? 0;
      const targetIds = result.page?.detail.targets.map((target) => target.id) ?? [];

      if (result.page?.detail.header.status === 'draft') {
        view.statusBanner = {
          kind: 'draft',
          tone: 'neutral',
          title: 'Campaign is still a draft',
          body: targetCount > 0
            ? `${targetCount} target${targetCount === 1 ? ' is' : 's are'} configured. Mark the campaign ready before launch.`
            : 'Finish configuring targets and metadata before launch.',
          targetCount,
          targetIds,
          primaryAction: view.operationalOverview.primaryAction,
          secondaryAction: view.operationalOverview.secondaryAction,
        };
        return view;
      }

      if (result.page?.detail.header.status === 'ready') {
        view.statusBanner = {
          kind: 'ready',
          tone: 'neutral',
          title: 'Campaign is ready to launch',
          body: `${targetCount} target${targetCount === 1 ? ' is' : 's are'} configured and waiting for launch.`,
          targetCount,
          targetIds,
          primaryAction: view.operationalOverview.primaryAction,
          secondaryAction: view.operationalOverview.secondaryAction,
        };
        return view;
      }

      view.statusBanner = {
        kind: 'stable',
        tone: 'success',
        title: 'Campaign is stable',
        body: 'No targets currently require review or retry.',
        targetCount: 0,
        targetIds: [],
        primaryAction: view.operationalOverview.primaryAction,
        secondaryAction: view.operationalOverview.secondaryAction,
      };
    }
  }
  return view;
}
