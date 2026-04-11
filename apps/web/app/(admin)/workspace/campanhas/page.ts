import type { AuthFetch } from '../../../../lib/auth-client';
import { campaignsApiClient } from '../../../../lib/campaigns-client';
import { buildCampaignListView, type CampaignListRow, type CampaignListView } from '../../../../components/campaigns/campaign-list';

export interface CampaignsPageData {
  campaigns: CampaignListRow[];
  total?: number;
  limit?: number;
  offset?: number;
  filters?: {
    status?: string;
    search?: string;
  };
}

export interface CampaignsPageView {
  list: CampaignListView;
  actions: {
    createHref: '/workspace/campanhas/nova';
    createLabel: 'Create campaign';
  };
  historyOverview?: {
    campaignsWithOutcomes: number;
    campaignsWithFailures: number;
    publishedTargets: number;
    failedTargets: number;
    pendingTargets: number;
    dominantOutcomeState: 'mixed' | 'failed' | 'pending' | 'healthy';
    outcomeStateCounts: {
      mixed: number;
      failed: number;
      pending: number;
      healthy: number;
    };
    outcomeStateCampaignIds: {
      mixed: string[];
      failed: string[];
      pending: string[];
      healthy: string[];
    };
    failureCampaignIds: string[];
    pendingCampaignIds: string[];
    primaryAction?: {
      kind: 'review_mixed_campaign' | 'review_failed_campaign' | 'review_pending_campaign';
      href: string;
    };
    secondaryAction?: {
      kind: 'review_mixed_campaign' | 'review_failed_campaign' | 'review_pending_campaign';
      href: string;
    };
  };
  historyBanner?: {
    kind: 'mixed' | 'failed' | 'pending' | 'healthy';
    tone: 'warning' | 'neutral' | 'success';
    title: string;
    body: string;
    publishedTargets: number;
    failedTargets: number;
    pendingTargets: number;
    outcomeStateCampaignIds: {
      mixed: string[];
      failed: string[];
      pending: string[];
      healthy: string[];
    };
    failureCampaignIds: string[];
    pendingCampaignIds: string[];
    primaryAction?: {
      kind: 'review_mixed_campaign' | 'review_failed_campaign' | 'review_pending_campaign';
      href: string;
    };
    secondaryAction?: {
      kind: 'review_mixed_campaign' | 'review_failed_campaign' | 'review_pending_campaign';
      href: string;
    };
  };
  reauthOverview?: {
    blockedCampaignCount: number;
    blockedTargetCount: number;
    blockedCampaignIds: string[];
    primaryAction: {
      kind: 'reauth_accounts';
      href: '/workspace/accounts';
    };
  };
  reauthBanner?: {
    tone: 'warning';
    title: string;
    body: string;
    blockedCampaignCount: number;
    blockedTargetCount: number;
    blockedCampaignIds: string[];
    primaryAction: {
      kind: 'reauth_accounts';
      href: '/workspace/accounts';
    };
  };
  scheduleOverview?: {
    scheduledCount: number;
    scheduledCampaignIds: string[];
    nextScheduledAt: string;
    nextCampaignId: string;
    nextCampaignTitle: string;
    nextCampaignHref: string;
    primaryAction: {
      kind: 'review_schedule';
      href: string;
    };
    secondaryAction?: {
      kind: 'review_schedule';
      href: string;
    };
  };
  scheduleBanner?: {
    tone: 'neutral';
    title: string;
    body: string;
    scheduledCount: number;
    scheduledCampaignIds: string[];
    nextScheduledAt: string;
    primaryCta: string;
    primaryHref: string;
    primaryAction: {
      kind: 'review_schedule';
      href: string;
    };
    secondaryAction?: {
      kind: 'review_schedule';
      href: string;
    };
  };
  appliedFilters?: {
    status?: string;
    search?: string;
    hasFilters: boolean;
    clearFiltersHref: string;
  };
  pagination?: {
    total: number;
    limit: number;
    offset: number;
    count: number;
    hasPrevious: boolean;
    hasNext: boolean;
    previousOffset?: number;
    nextOffset?: number;
    previousHref?: string;
    nextHref?: string;
  };
  emptyState?: {
    heading: string;
    body: string;
    cta: string;
    ctaHref?: string;
    clearFiltersHref?: string;
  };
}

export interface CampaignsPageLoadResult {
  page?: CampaignsPageView;
  error?: string;
  errorState?: {
    heading: string;
    body: string;
    cta: string;
    retryHref: string;
  };
}

function buildCampaignsPageHref(filters?: {
  status?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): string {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.search) params.set('search', filters.search);
  if (filters?.limit !== undefined) params.set('limit', String(filters.limit));
  if (filters?.offset !== undefined) params.set('offset', String(filters.offset));
  const query = params.toString();
  return query ? `/workspace/campanhas?${query}` : '/workspace/campanhas';
}

export function buildCampaignsPageView(data: CampaignsPageData): CampaignsPageView {
  const list = buildCampaignListView({ rows: data.campaigns });

  const view: CampaignsPageView = {
    list,
    actions: {
      createHref: '/workspace/campanhas/nova',
      createLabel: 'Create campaign',
    },
  };
  const rowsWithOutcomeSummary = list.rows.filter((row) => Boolean(row.outcomeSummary));
  const rowsWithReauth = list.rows.filter((row) => (row.reauthRequiredCount ?? 0) > 0);
  const scheduledReadyCampaigns = list.rows
    .filter((row) => row.status === 'ready' && typeof row.scheduledAt === 'string')
    .sort((left, right) => left.scheduledAt!.localeCompare(right.scheduledAt!));
  const hasFilters = Boolean(data.filters?.status || data.filters?.search);

  if (rowsWithOutcomeSummary.length > 0) {
    const outcomeStateCounts = rowsWithOutcomeSummary.reduce(
      (counts, row) => {
        if (row.outcomeState) {
          counts[row.outcomeState] += 1;
        }
        return counts;
      },
      {
        mixed: 0,
        failed: 0,
        pending: 0,
        healthy: 0,
      },
    );
    const dominantOutcomeState = outcomeStateCounts.mixed > 0
      ? 'mixed'
      : outcomeStateCounts.failed > 0
        ? 'failed'
        : outcomeStateCounts.pending > 0
          ? 'pending'
          : 'healthy';
    const outcomeStateCampaignIds = {
      mixed: rowsWithOutcomeSummary
        .filter((row) => row.outcomeState === 'mixed')
        .map((row) => row.id),
      failed: rowsWithOutcomeSummary
        .filter((row) => row.outcomeState === 'failed')
        .map((row) => row.id),
      pending: rowsWithOutcomeSummary
        .filter((row) => row.outcomeState === 'pending')
        .map((row) => row.id),
      healthy: rowsWithOutcomeSummary
        .filter((row) => row.outcomeState === 'healthy')
        .map((row) => row.id),
    };
    const failureCampaignIds = rowsWithOutcomeSummary
      .filter((row) => (row.outcomeSummary?.failedCount ?? 0) > 0)
      .map((row) => row.id);
    const pendingCampaignIds = rowsWithOutcomeSummary
      .filter((row) => (row.outcomeSummary?.pendingCount ?? 0) > 0)
      .map((row) => row.id);
    const firstMixedCampaign = rowsWithOutcomeSummary.find((row) => row.outcomeState === 'mixed');
    const nextMixedCampaign = rowsWithOutcomeSummary.find((row) =>
      row.outcomeState === 'mixed' && row.detailHref !== firstMixedCampaign?.detailHref);
    const firstFailedCampaign = rowsWithOutcomeSummary.find((row) => row.outcomeState === 'failed');
    const nextFailedCampaign = rowsWithOutcomeSummary.find((row) =>
      row.outcomeState === 'failed' && row.detailHref !== firstFailedCampaign?.detailHref);
    const firstPendingCampaign = rowsWithOutcomeSummary.find((row) => row.outcomeState === 'pending');
    const nextPendingCampaign = rowsWithOutcomeSummary.find((row) =>
      row.outcomeState === 'pending' && row.detailHref !== firstPendingCampaign?.detailHref);
    const primaryFailureCampaign = dominantOutcomeState === 'mixed'
      ? firstMixedCampaign ?? firstFailedCampaign
      : firstFailedCampaign;
    const historyPrimaryAction = primaryFailureCampaign?.detailHref
      ? {
        kind: dominantOutcomeState === 'mixed' && primaryFailureCampaign.id === firstMixedCampaign?.id
          ? 'review_mixed_campaign' as const
          : 'review_failed_campaign' as const,
        href: primaryFailureCampaign.detailHref,
      }
      : firstPendingCampaign?.detailHref
        ? {
          kind: 'review_pending_campaign' as const,
          href: firstPendingCampaign.detailHref,
        }
        : undefined;
    const secondaryFailedCampaign = firstFailedCampaign?.detailHref !== historyPrimaryAction?.href
      ? firstFailedCampaign
      : nextFailedCampaign;
    const secondaryPendingCampaign = firstPendingCampaign?.detailHref !== historyPrimaryAction?.href
      ? firstPendingCampaign
      : nextPendingCampaign;
    const historySecondaryAction = secondaryFailedCampaign?.detailHref
      && secondaryFailedCampaign.detailHref !== historyPrimaryAction?.href
      ? {
        kind: 'review_failed_campaign' as const,
        href: secondaryFailedCampaign.detailHref,
      }
      : nextMixedCampaign?.detailHref
      && nextMixedCampaign.detailHref !== historyPrimaryAction?.href
      ? {
        kind: 'review_mixed_campaign' as const,
        href: nextMixedCampaign.detailHref,
      }
      : secondaryPendingCampaign?.detailHref
      && secondaryPendingCampaign.detailHref !== historyPrimaryAction?.href
      ? {
        kind: 'review_pending_campaign' as const,
        href: secondaryPendingCampaign.detailHref,
      }
      : undefined;
    view.historyOverview = {
      campaignsWithOutcomes: rowsWithOutcomeSummary.length,
      campaignsWithFailures: rowsWithOutcomeSummary.filter((row) => (row.outcomeSummary?.failedCount ?? 0) > 0).length,
      publishedTargets: rowsWithOutcomeSummary.reduce((total, row) => total + (row.outcomeSummary?.publishedCount ?? 0), 0),
      failedTargets: rowsWithOutcomeSummary.reduce((total, row) => total + (row.outcomeSummary?.failedCount ?? 0), 0),
      pendingTargets: rowsWithOutcomeSummary.reduce((total, row) => total + (row.outcomeSummary?.pendingCount ?? 0), 0),
      dominantOutcomeState,
      outcomeStateCounts,
      outcomeStateCampaignIds,
      failureCampaignIds,
      pendingCampaignIds,
      primaryAction: historyPrimaryAction,
      secondaryAction: historySecondaryAction,
    };
    view.historyBanner = {
      kind: view.historyOverview.dominantOutcomeState,
      tone: view.historyOverview.failedTargets > 0
        ? 'warning'
        : view.historyOverview.pendingTargets > 0
          ? 'neutral'
          : 'success',
      title: view.historyOverview.failedTargets > 0
        ? 'Campaign outcomes need attention'
        : view.historyOverview.pendingTargets > 0
          ? 'Campaign outcomes are still in motion'
          : 'Campaign outcomes look healthy',
      body: `Visible outcomes: ${view.historyOverview.publishedTargets} published, ${view.historyOverview.failedTargets} failed, ${view.historyOverview.pendingTargets} pending across ${view.historyOverview.campaignsWithOutcomes} campaign${view.historyOverview.campaignsWithOutcomes === 1 ? '' : 's'}.`,
      publishedTargets: view.historyOverview.publishedTargets,
      failedTargets: view.historyOverview.failedTargets,
      pendingTargets: view.historyOverview.pendingTargets,
      outcomeStateCampaignIds,
      failureCampaignIds,
      pendingCampaignIds,
      primaryAction: historyPrimaryAction,
      secondaryAction: historySecondaryAction,
    };
  }

  if (rowsWithReauth.length > 0) {
    const blockedCampaignCount = rowsWithReauth.length;
    const blockedTargetCount = rowsWithReauth.reduce((total, row) => total + (row.reauthRequiredCount ?? 0), 0);
    const blockedCampaignIds = rowsWithReauth.map((row) => row.id);
    const primaryAction = {
      kind: 'reauth_accounts' as const,
      href: '/workspace/accounts' as const,
    };

    view.reauthOverview = {
      blockedCampaignCount,
      blockedTargetCount,
      blockedCampaignIds,
      primaryAction,
    };
    view.reauthBanner = {
      tone: 'warning',
      title: 'Campaigns blocked by account reauthorization',
      body: `${blockedCampaignCount} campaign${blockedCampaignCount === 1 ? '' : 's'} include${blockedCampaignCount === 1 ? 's' : ''} ${blockedTargetCount} target${blockedTargetCount === 1 ? '' : 's'} waiting for account reauthorization.`,
      blockedCampaignCount,
      blockedTargetCount,
      blockedCampaignIds,
      primaryAction,
    };
  }

  if (scheduledReadyCampaigns.length > 0) {
    const nextCampaign = scheduledReadyCampaigns[0];
    const secondaryScheduledCampaign = scheduledReadyCampaigns[1];
    const scheduledCampaignIds = scheduledReadyCampaigns.map((campaign) => campaign.id);
    view.scheduleOverview = {
      scheduledCount: scheduledReadyCampaigns.length,
      scheduledCampaignIds,
      nextScheduledAt: nextCampaign.scheduledAt!,
      nextCampaignId: nextCampaign.id,
      nextCampaignTitle: nextCampaign.title,
      nextCampaignHref: nextCampaign.detailHref!,
      primaryAction: {
        kind: 'review_schedule',
        href: nextCampaign.detailHref!,
      },
      secondaryAction: secondaryScheduledCampaign?.detailHref
        ? {
          kind: 'review_schedule',
          href: secondaryScheduledCampaign.detailHref,
        }
        : undefined,
    };
    view.scheduleBanner = {
      tone: 'neutral',
      title: 'Upcoming scheduled campaigns',
      body: `${scheduledReadyCampaigns.length} ready campaign${scheduledReadyCampaigns.length === 1 ? ' is' : 's are'} scheduled. Next up: ${nextCampaign.title} at ${nextCampaign.scheduledAt!}.`,
      scheduledCount: scheduledReadyCampaigns.length,
      scheduledCampaignIds,
      nextScheduledAt: nextCampaign.scheduledAt!,
      primaryCta: 'Open next scheduled campaign',
      primaryHref: nextCampaign.detailHref!,
      primaryAction: {
        kind: 'review_schedule',
        href: nextCampaign.detailHref!,
      },
      secondaryAction: secondaryScheduledCampaign?.detailHref
        ? {
          kind: 'review_schedule',
          href: secondaryScheduledCampaign.detailHref,
        }
        : undefined,
    };
  }

  if (hasFilters) {
    view.appliedFilters = {
      status: data.filters?.status,
      search: data.filters?.search,
      hasFilters,
      clearFiltersHref: '/workspace/campanhas',
    };
  }

  if (
    data.total !== undefined
    && data.limit !== undefined
    && data.offset !== undefined
  ) {
    const hasPrevious = data.offset > 0;
    const hasNext = data.offset + data.limit < data.total;

    view.pagination = {
      total: data.total,
      limit: data.limit,
      offset: data.offset,
      count: data.campaigns.length,
      hasPrevious,
      hasNext,
      previousOffset: hasPrevious ? Math.max(data.offset - data.limit, 0) : undefined,
      nextOffset: hasNext ? data.offset + data.limit : undefined,
      previousHref: hasPrevious
        ? buildCampaignsPageHref({
          ...data.filters,
          limit: data.limit,
          offset: Math.max(data.offset - data.limit, 0),
        })
        : undefined,
      nextHref: hasNext
        ? buildCampaignsPageHref({
          ...data.filters,
          limit: data.limit,
          offset: data.offset + data.limit,
        })
        : undefined,
    };
  }

  if (list.isEmpty) {
    if ((view.pagination?.hasPrevious ?? false) && (data.total ?? 0) > 0) {
      view.emptyState = {
        heading: 'No campaigns on this page',
        body: 'Go back to the previous page or adjust your filters.',
        cta: 'Previous page',
        ctaHref: view.pagination?.previousHref,
        clearFiltersHref: view.pagination?.previousHref,
      };
    } else {
      view.emptyState = hasFilters
        ? {
          heading: 'No campaigns match the current filters',
          body: 'Try clearing filters or adjusting your search.',
          cta: 'Clear filters',
          ctaHref: '/workspace/campanhas',
          clearFiltersHref: '/workspace/campanhas',
        }
        : {
          heading: 'No campaigns yet',
          body: 'Create a campaign to publish a video to multiple YouTube channels at once.',
          cta: 'Create campaign',
          ctaHref: '/workspace/campanhas/nova',
        };
    }
  }

  return view;
}

export async function buildCampaignsPage(options?: {
  fetcher?: AuthFetch;
  filters?: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
  };
}): Promise<CampaignsPageLoadResult> {
  const client = campaignsApiClient(options?.fetcher ?? globalThis.fetch as AuthFetch);
  const result = await client.listCampaigns(options?.filters);

  if (!result.ok) {
    return {
      error: result.error,
      errorState: {
        heading: 'Campaign list unavailable',
        body: result.error,
        cta: 'Retry',
        retryHref: '/workspace/campanhas',
      },
    };
  }

  return {
    page: buildCampaignsPageView({
      campaigns: result.campaigns as CampaignListRow[],
      total: result.total,
      limit: result.limit,
      offset: result.offset,
      filters: options?.filters,
    }),
  };
}
