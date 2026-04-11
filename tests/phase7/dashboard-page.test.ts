import { describe, expect, test } from 'vitest';

import {
  buildDashboardPageView,
  type DashboardPageData,
} from '../../apps/web/app/(admin)/workspace/dashboard/page';
import type { DashboardData } from '../../apps/web/components/campaigns/dashboard';

describe('dashboard page view builder', () => {
  test('produces dashboard view from API data', () => {
    const apiData: DashboardData = {
      campaigns: { total: 5, byStatus: { draft: 1, ready: 1, launching: 1, completed: 1, failed: 1 } },
      targets: { total: 20, byStatus: { aguardando: 2, enviando: 2, publicado: 12, erro: 4 }, successRate: 75 },
      jobs: { total: 25, byStatus: { queued: 1, processing: 1, completed: 18, failed: 5 }, totalRetries: 3 },
      quota: {
        dailyLimitUnits: 10000,
        estimatedConsumedUnits: 8200,
        estimatedQueuedUnits: 400,
        estimatedProjectedUnits: 8600,
        estimatedRemainingUnits: 1800,
        usagePercent: 82,
        projectedPercent: 86,
        warningState: 'warning',
      },
      failures: {
        failedCampaigns: 1,
        failedTargets: 2,
        topReason: 'quota_exceeded',
        reasons: [{ reason: 'quota_exceeded', count: 2 }],
      },
      retries: {
        retriedTargets: 2,
        highestAttempt: 3,
        hotspotChannelId: 'ch-1',
        hotspotRetryCount: 2,
      },
      audit: {
        totalEvents: 2,
        byType: { launch_campaign: 1, retry_target: 1, mark_ready: 0, clone_campaign: 0, delete_campaign: 0, update_campaign: 0, remove_target: 0, update_target: 0, add_target: 0, add_targets_bulk: 0, publish_completed: 0, publish_failed: 0, publish_partial_failure: 0 },
        lastEventAt: '2026-04-10T09:45:00Z',
        lastEventType: 'retry_target',
        lastActorEmail: 'admin@test.com',
      },
      reauth: { blockedCampaigns: 1, blockedTargets: 2, blockedChannelCount: 1, blockedChannelIds: ['ch-1'] },
      channels: [
        { channelId: 'ch-1', totalTargets: 10, published: 8, failed: 2, successRate: 80 },
      ],
    };

    const view = buildDashboardPageView({ stats: apiData });

    expect(view.dashboard.summaryCards).toHaveLength(4);
    expect(view.dashboard.summaryCards[0].value).toBe(5);
    expect(view.dashboard.channelLeaderboard).toHaveLength(1);
    expect(view.dashboard.reauthSummary).toEqual({
      blockedCampaigns: 1,
      blockedTargets: 2,
      blockedChannelCount: 1,
      blockedChannelIds: ['ch-1'],
      primaryAction: {
        kind: 'reauth_accounts',
        href: '/workspace/accounts',
      },
    });
    expect(view.dashboard.quotaSummary).toEqual({
      dailyLimitUnits: 10000,
      estimatedConsumedUnits: 8200,
      estimatedQueuedUnits: 400,
      estimatedProjectedUnits: 8600,
      estimatedRemainingUnits: 1800,
      usagePercent: 82,
      projectedPercent: 86,
      warningState: 'warning',
    });
    expect(view.dashboard.failureSummary).toEqual({
      failedCampaigns: 1,
      failedTargets: 2,
      topReason: 'quota_exceeded',
      topReasonLabel: 'Quota exceeded',
      reasons: [{ reason: 'quota_exceeded', label: 'Quota exceeded', count: 2 }],
      primaryAction: {
        kind: 'review_campaigns',
        href: '/workspace/campanhas',
      },
    });
    expect(view.dashboard.retrySummary).toEqual({
      totalRetries: 3,
      retriedTargets: 2,
      highestAttempt: 3,
      hotspotChannelId: 'ch-1',
      hotspotRetryCount: 2,
      primaryAction: {
        kind: 'review_campaigns',
        href: '/workspace/campanhas',
      },
    });
    expect(view.dashboard.auditSummary).toEqual({
      totalEvents: 2,
      launchCampaigns: 1,
      retryTargets: 1,
      markReadyCampaigns: 0,
      clonedCampaigns: 0,
      deletedCampaigns: 0,
      updatedCampaigns: 0,
      removedTargets: 0,
      updatedTargets: 0,
      addedTargets: 0,
      bulkTargetAdds: 0,
      completedPublishes: 0,
      failedPublishes: 0,
      partialFailedPublishes: 0,
      lastEventAt: '2026-04-10T09:45:00Z',
      lastEventType: 'retry_target',
      lastActorEmail: 'admin@test.com',
      primaryAction: {
        kind: 'review_campaigns',
        href: '/workspace/campanhas',
      },
    });
    expect(view.dashboard.isEmpty).toBe(false);
  });

  test('shows empty state when no data', () => {
    const emptyData: DashboardData = {
      campaigns: { total: 0, byStatus: { draft: 0, ready: 0, launching: 0, completed: 0, failed: 0 } },
      targets: { total: 0, byStatus: { aguardando: 0, enviando: 0, publicado: 0, erro: 0 }, successRate: 0 },
      jobs: { total: 0, byStatus: { queued: 0, processing: 0, completed: 0, failed: 0 }, totalRetries: 0 },
      quota: {
        dailyLimitUnits: 10000,
        estimatedConsumedUnits: 0,
        estimatedQueuedUnits: 0,
        estimatedProjectedUnits: 0,
        estimatedRemainingUnits: 10000,
        usagePercent: 0,
        projectedPercent: 0,
        warningState: 'healthy',
      },
      failures: {
        failedCampaigns: 0,
        failedTargets: 0,
        topReason: null,
        reasons: [],
      },
      retries: {
        retriedTargets: 0,
        highestAttempt: 0,
        hotspotChannelId: null,
        hotspotRetryCount: 0,
      },
      audit: {
        totalEvents: 0,
        byType: { launch_campaign: 0, retry_target: 0, mark_ready: 0, clone_campaign: 0, delete_campaign: 0, update_campaign: 0, remove_target: 0, update_target: 0, add_target: 0, add_targets_bulk: 0, publish_completed: 0, publish_failed: 0, publish_partial_failure: 0 },
        lastEventAt: null,
        lastEventType: null,
        lastActorEmail: null,
      },
      reauth: { blockedCampaigns: 0, blockedTargets: 0, blockedChannelCount: 0, blockedChannelIds: [] },
      channels: [],
    };

    const view = buildDashboardPageView({ stats: emptyData });

    expect(view.dashboard.isEmpty).toBe(true);
    expect(view.emptyState).toBeDefined();
    expect(view.emptyState!.heading).toContain('No data');
  });
});
