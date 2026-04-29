import { describe, expect, test } from 'vitest';

import {
  buildDashboardView,
  type DashboardData,
} from '../../apps/web/components/campaigns/dashboard';

describe('buildDashboardView', () => {
  test('renders summary cards from stats', () => {
    const data: DashboardData = {
      campaigns: { total: 10, byStatus: { draft: 2, ready: 1, launching: 1, completed: 5, failed: 1 } },
      targets: { total: 30, byStatus: { aguardando: 3, enviando: 2, publicado: 20, erro: 5 }, successRate: 66.67 },
      jobs: { total: 40, byStatus: { queued: 2, processing: 1, completed: 30, failed: 7 }, totalRetries: 5 },
      quota: {
        dailyLimitUnits: 10000,
        estimatedConsumedUnits: 3400,
        estimatedQueuedUnits: 600,
        estimatedProjectedUnits: 4000,
        estimatedRemainingUnits: 6600,
        usagePercent: 34,
        projectedPercent: 40,
        warningState: 'healthy',
      },
      failures: {
        failedCampaigns: 1,
        failedTargets: 2,
        topReason: 'quota_exceeded',
        reasons: [{ reason: 'quota_exceeded', count: 2 }],
      },
      retries: {
        retriedTargets: 1,
        highestAttempt: 2,
        hotspotChannelId: 'ch-2',
        hotspotRetryCount: 1,
      },
      audit: {
        totalEvents: 2,
        byType: { launch_campaign: 1, retry_target: 1, mark_ready: 0, clone_campaign: 0, delete_campaign: 0, update_campaign: 0, remove_target: 0, update_target: 0, add_target: 0, add_targets_bulk: 0, publish_completed: 0, publish_failed: 0, publish_partial_failure: 0 },
        lastEventAt: '2026-04-10T10:15:00Z',
        lastEventType: 'retry_target',
        lastActorEmail: 'admin@test.com',
      },
      reauth: { blockedCampaigns: 0, blockedTargets: 0, blockedChannelCount: 0, blockedChannelIds: [] },
      channels: [
        { channelId: 'ch-1', totalTargets: 15, published: 12, failed: 3, successRate: 80 },
        { channelId: 'ch-2', totalTargets: 15, published: 8, failed: 2, successRate: 53.33 },
      ],
    };

    const view = buildDashboardView(data);

    expect(view.summaryCards).toHaveLength(4);
    expect(view.summaryCards[0]).toMatchObject({ label: 'Total Campaigns', value: 10 });
    expect(view.summaryCards[1]).toMatchObject({ label: 'Published Videos', value: 20 });
    expect(view.summaryCards[2]).toMatchObject({ label: 'Success Rate', value: '66.7%' });
    expect(view.summaryCards[3]).toMatchObject({ label: 'Failed Uploads', value: 5 });
  });

  test('renders campaign status breakdown', () => {
    const data: DashboardData = {
      campaigns: { total: 5, byStatus: { draft: 1, ready: 1, launching: 1, completed: 1, failed: 1 } },
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

    const view = buildDashboardView(data);

    expect(view.campaignBreakdown).toEqual([
      { status: 'draft', count: 1 },
      { status: 'ready', count: 1 },
      { status: 'launching', count: 1 },
      { status: 'completed', count: 1 },
      { status: 'failed', count: 1 },
    ]);
  });

  test('renders channel leaderboard sorted by published desc', () => {
    const data: DashboardData = {
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
      channels: [
        { channelId: 'ch-low', totalTargets: 5, published: 2, failed: 3, successRate: 40 },
        { channelId: 'ch-high', totalTargets: 10, published: 9, failed: 1, successRate: 90 },
        { channelId: 'ch-mid', totalTargets: 8, published: 5, failed: 3, successRate: 62.5 },
      ],
    };

    const view = buildDashboardView(data);

    expect(view.channelLeaderboard).toHaveLength(3);
    expect(view.channelLeaderboard[0].channelId).toBe('ch-high');
    expect(view.channelLeaderboard[1].channelId).toBe('ch-mid');
    expect(view.channelLeaderboard[2].channelId).toBe('ch-low');
  });

  test('empty dashboard renders zero-state', () => {
    const data: DashboardData = {
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

    const view = buildDashboardView(data);

    expect(view.isEmpty).toBe(true);
    expect(view.summaryCards[0].value).toBe(0);
    expect(view.channelLeaderboard).toHaveLength(0);
  });

  test('renders a reauth summary and banner when campaigns are blocked by reconnect requirements', () => {
    const data: DashboardData = {
      campaigns: { total: 4, byStatus: { draft: 0, ready: 1, launching: 1, completed: 1, failed: 1 } },
      targets: { total: 10, byStatus: { aguardando: 2, enviando: 1, publicado: 5, erro: 2 }, successRate: 71.43 },
      jobs: { total: 12, byStatus: { queued: 1, processing: 1, completed: 8, failed: 2 }, totalRetries: 1 },
      quota: {
        dailyLimitUnits: 10000,
        estimatedConsumedUnits: 9600,
        estimatedQueuedUnits: 500,
        estimatedProjectedUnits: 10100,
        estimatedRemainingUnits: 400,
        usagePercent: 96,
        projectedPercent: 101,
        warningState: 'critical',
      },
      failures: {
        failedCampaigns: 1,
        failedTargets: 1,
        topReason: 'quota_exceeded',
        reasons: [{ reason: 'quota_exceeded', count: 1 }],
      },
      retries: {
        retriedTargets: 2,
        highestAttempt: 3,
        hotspotChannelId: 'ch-1',
        hotspotRetryCount: 2,
      },
      audit: {
        totalEvents: 3,
        byType: { launch_campaign: 1, retry_target: 2, mark_ready: 0, clone_campaign: 0, delete_campaign: 0, update_campaign: 0, remove_target: 0, update_target: 0, add_target: 0, add_targets_bulk: 0, publish_completed: 0, publish_failed: 0, publish_partial_failure: 0 },
        lastEventAt: '2026-04-10T12:00:00Z',
        lastEventType: 'retry_target',
        lastActorEmail: 'ops@test.com',
      },
      reauth: { blockedCampaigns: 2, blockedTargets: 3, blockedChannelCount: 2, blockedChannelIds: ['ch-1', 'ch-2'] },
      channels: [
        { channelId: 'ch-1', totalTargets: 6, published: 4, failed: 2, successRate: 66.67 },
      ],
    };

    const view = buildDashboardView(data);

    expect(view.reauthSummary).toEqual({
      blockedCampaigns: 2,
      blockedTargets: 3,
      blockedChannelCount: 2,
      blockedChannelIds: ['ch-1', 'ch-2'],
      primaryAction: {
        kind: 'reauth_accounts',
        href: '/workspace/accounts',
      },
    });
    expect(view.reauthBanner).toEqual({
      tone: 'warning',
      title: 'Reconnect required for blocked campaigns',
      body: '2 campaigns include 3 targets blocked by account reauthorization across 2 channels.',
      blockedCampaigns: 2,
      blockedTargets: 3,
      blockedChannelCount: 2,
      blockedChannelIds: ['ch-1', 'ch-2'],
      primaryAction: {
        kind: 'reauth_accounts',
        href: '/workspace/accounts',
      },
    });
  });

  test('renders a quota summary and warning banner when projected quota approaches the daily limit', () => {
    const data: DashboardData = {
      campaigns: { total: 6, byStatus: { draft: 0, ready: 2, launching: 1, completed: 2, failed: 1 } },
      targets: { total: 18, byStatus: { aguardando: 4, enviando: 2, publicado: 9, erro: 3 }, successRate: 75 },
      jobs: { total: 20, byStatus: { queued: 5, processing: 2, completed: 10, failed: 3 }, totalRetries: 2 },
      quota: {
        dailyLimitUnits: 10000,
        estimatedConsumedUnits: 7800,
        estimatedQueuedUnits: 700,
        estimatedProjectedUnits: 8500,
        estimatedRemainingUnits: 2200,
        usagePercent: 78,
        projectedPercent: 85,
        warningState: 'warning',
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

    const view = buildDashboardView(data);

    expect(view.quotaSummary).toEqual({
      dailyLimitUnits: 10000,
      estimatedConsumedUnits: 7800,
      estimatedQueuedUnits: 700,
      estimatedProjectedUnits: 8500,
      estimatedRemainingUnits: 2200,
      usagePercent: 78,
      projectedPercent: 85,
      warningState: 'warning',
    });
    expect(view.quotaBanner).toEqual({
      tone: 'warning',
      title: 'Estimated quota usage is approaching the daily limit',
      body: 'Projected usage is 8500 of 10000 units, with 700 queued units still pending.',
      dailyLimitUnits: 10000,
      estimatedConsumedUnits: 7800,
      estimatedQueuedUnits: 700,
      estimatedProjectedUnits: 8500,
      estimatedRemainingUnits: 2200,
      usagePercent: 78,
      projectedPercent: 85,
      warningState: 'warning',
      primaryAction: {
        kind: 'review_campaigns',
        href: '/workspace/campanhas',
      },
    });
  });

  test('renders a failure summary and banner when non-reauth failures exist', () => {
    const data: DashboardData = {
      campaigns: { total: 5, byStatus: { draft: 0, ready: 1, launching: 1, completed: 2, failed: 1 } },
      targets: { total: 14, byStatus: { aguardando: 1, enviando: 1, publicado: 9, erro: 3 }, successRate: 75 },
      jobs: { total: 16, byStatus: { queued: 1, processing: 1, completed: 11, failed: 3 }, totalRetries: 2 },
      quota: {
        dailyLimitUnits: 10000,
        estimatedConsumedUnits: 2200,
        estimatedQueuedUnits: 100,
        estimatedProjectedUnits: 2300,
        estimatedRemainingUnits: 7800,
        usagePercent: 22,
        projectedPercent: 23,
        warningState: 'healthy',
      },
      failures: {
        failedCampaigns: 2,
        failedTargets: 3,
        topReason: 'quota_exceeded',
        reasons: [
          { reason: 'quota_exceeded', count: 2 },
          { reason: 'post_upload_step_failed', count: 1 },
        ],
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

    const view = buildDashboardView(data);

    expect(view.failureSummary).toEqual({
      failedCampaigns: 2,
      failedTargets: 3,
      topReason: 'quota_exceeded',
      topReasonLabel: 'Quota exceeded',
      reasons: [
        { reason: 'quota_exceeded', label: 'Quota exceeded', count: 2 },
        { reason: 'post_upload_step_failed', label: 'Post-upload step failed', count: 1 },
      ],
      primaryAction: {
        kind: 'review_campaigns',
        href: '/workspace/campanhas',
      },
    });
    expect(view.failureBanner).toEqual({
      tone: 'warning',
      title: 'Quota exceeded is the most common failure reason',
      body: '3 failed targets across 2 campaigns need review.',
      failedCampaigns: 2,
      failedTargets: 3,
      topReason: 'quota_exceeded',
      topReasonLabel: 'Quota exceeded',
      reasons: [
        { reason: 'quota_exceeded', label: 'Quota exceeded', count: 2 },
        { reason: 'post_upload_step_failed', label: 'Post-upload step failed', count: 1 },
      ],
      primaryAction: {
        kind: 'review_campaigns',
        href: '/workspace/campanhas',
      },
    });
  });

  test('renders an actionable failed job queue', () => {
    const data: DashboardData = {
      campaigns: { total: 2, byStatus: { draft: 0, ready: 0, launching: 0, completed: 1, failed: 1 } },
      targets: { total: 4, byStatus: { aguardando: 0, enviando: 0, publicado: 1, erro: 3 }, successRate: 25 },
      jobs: { total: 3, byStatus: { queued: 0, processing: 0, completed: 0, failed: 3 }, totalRetries: 0 },
      quota: {
        dailyLimitUnits: 10000,
        estimatedConsumedUnits: 300,
        estimatedQueuedUnits: 0,
        estimatedProjectedUnits: 300,
        estimatedRemainingUnits: 9700,
        usagePercent: 3,
        projectedPercent: 3,
        warningState: 'healthy',
      },
      failures: {
        failedCampaigns: 1,
        failedTargets: 2,
        topReason: 'other_failure',
        reasons: [{ reason: 'other_failure', count: 2 }],
      },
      failedJobs: [
        {
          jobId: 'job-retry',
          campaignId: 'campaign-1',
          campaignTitle: 'Spring Launch',
          targetId: 'target-retry',
          platform: 'tiktok',
          destinationId: 'tt-account',
          destinationLabel: 'TikTok Main',
          videoTitle: 'Clip Retry',
          errorMessage: 'temporarily unavailable',
          errorClass: 'transient',
          attempt: 1,
          failedAt: '2026-04-28T12:00:01.000Z',
          suggestedAction: 'retry',
        },
        {
          jobId: null,
          campaignId: 'campaign-1',
          campaignTitle: 'Spring Launch',
          targetId: 'target-reauth',
          platform: 'youtube',
          destinationId: 'ch-reauth',
          destinationLabel: null,
          videoTitle: 'Clip Reauth',
          errorMessage: 'REAUTH_REQUIRED',
          errorClass: null,
          attempt: null,
          failedAt: null,
          suggestedAction: 'reauth',
        },
        {
          jobId: 'job-review',
          campaignId: 'campaign-2',
          campaignTitle: 'Policy Check',
          targetId: 'target-review',
          platform: 'instagram',
          destinationId: 'ig-account',
          destinationLabel: 'Instagram Main',
          videoTitle: 'Clip Review',
          errorMessage: 'copyright violation',
          errorClass: 'permanent',
          attempt: 1,
          failedAt: '2026-04-28T12:00:02.000Z',
          suggestedAction: 'review',
        },
      ],
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
      reauth: { blockedCampaigns: 1, blockedTargets: 1, blockedChannelCount: 1, blockedChannelIds: ['ch-reauth'] },
      channels: [],
    };

    const view = buildDashboardView(data);

    expect(view.failedJobQueue).toMatchObject({
      total: 3,
      retryableCount: 1,
      reauthCount: 1,
      reviewCount: 1,
    });
    expect(view.failedJobQueue?.rows.map((row) => row.primaryAction)).toEqual([
      {
        kind: 'retry_target',
        label: 'Retry',
        href: '/api/campaigns/campaign-1/targets/target-retry/retry',
      },
      {
        kind: 'reauth_accounts',
        label: 'Reconnect account',
        href: '/workspace/accounts',
      },
      {
        kind: 'review_campaign',
        label: 'Review campaign',
        href: '/workspace/campanhas/campaign-2',
      },
    ]);
    expect(view.failedJobQueue?.rows.map((row) => ({
      campaignHref: row.campaignHref,
      historyHref: row.historyHref,
    }))).toEqual([
      {
        campaignHref: '/workspace/campanhas/campaign-1',
        historyHref: '/api/campaigns/campaign-1/targets/target-retry/jobs',
      },
      {
        campaignHref: '/workspace/campanhas/campaign-1',
        historyHref: '/api/campaigns/campaign-1/targets/target-reauth/jobs',
      },
      {
        campaignHref: '/workspace/campanhas/campaign-2',
        historyHref: '/api/campaigns/campaign-2/targets/target-review/jobs',
      },
    ]);
    expect(view.failedJobBanner).toEqual({
      tone: 'warning',
      title: 'Failed publishing work needs attention',
      body: '3 failed targets: 1 retryable, 1 need reconnect, 1 need review.',
      total: 3,
      retryableCount: 1,
      reauthCount: 1,
      reviewCount: 1,
      primaryAction: {
        kind: 'review_failed_jobs',
        href: '/workspace/campanhas',
      },
    });
  });

  test('renders a retry summary and banner when retries accumulate on a channel', () => {
    const data: DashboardData = {
      campaigns: { total: 4, byStatus: { draft: 0, ready: 1, launching: 1, completed: 1, failed: 1 } },
      targets: { total: 12, byStatus: { aguardando: 1, enviando: 1, publicado: 7, erro: 3 }, successRate: 70 },
      jobs: { total: 12, byStatus: { queued: 1, processing: 1, completed: 7, failed: 3 }, totalRetries: 4 },
      quota: {
        dailyLimitUnits: 10000,
        estimatedConsumedUnits: 1800,
        estimatedQueuedUnits: 200,
        estimatedProjectedUnits: 2000,
        estimatedRemainingUnits: 8200,
        usagePercent: 18,
        projectedPercent: 20,
        warningState: 'healthy',
      },
      failures: {
        failedCampaigns: 1,
        failedTargets: 2,
        topReason: 'other_failure',
        reasons: [{ reason: 'other_failure', count: 2 }],
      },
      retries: {
        retriedTargets: 2,
        highestAttempt: 3,
        hotspotChannelId: 'ch-hotspot',
        hotspotRetryCount: 3,
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

    const view = buildDashboardView(data);

    expect(view.retrySummary).toEqual({
      totalRetries: 4,
      retriedTargets: 2,
      highestAttempt: 3,
      hotspotChannelId: 'ch-hotspot',
      hotspotRetryCount: 3,
      primaryAction: {
        kind: 'review_campaigns',
        href: '/workspace/campanhas',
      },
    });
    expect(view.retryBanner).toEqual({
      tone: 'warning',
      title: 'Retries are concentrating on ch-hotspot',
      body: '4 extra retry attempts are spread across 2 targets, with 3 on ch-hotspot.',
      totalRetries: 4,
      retriedTargets: 2,
      highestAttempt: 3,
      hotspotChannelId: 'ch-hotspot',
      hotspotRetryCount: 3,
      primaryAction: {
        kind: 'review_campaigns',
        href: '/workspace/campanhas',
      },
    });
  });

  test('renders an audit summary and banner when launch and retry actions were recorded', () => {
    const data: DashboardData = {
      campaigns: { total: 3, byStatus: { draft: 0, ready: 1, launching: 1, completed: 1, failed: 0 } },
      targets: { total: 8, byStatus: { aguardando: 1, enviando: 1, publicado: 6, erro: 0 }, successRate: 100 },
      jobs: { total: 8, byStatus: { queued: 1, processing: 1, completed: 6, failed: 0 }, totalRetries: 1 },
      quota: {
        dailyLimitUnits: 10000,
        estimatedConsumedUnits: 900,
        estimatedQueuedUnits: 100,
        estimatedProjectedUnits: 1000,
        estimatedRemainingUnits: 9100,
        usagePercent: 9,
        projectedPercent: 10,
        warningState: 'healthy',
      },
      failures: {
        failedCampaigns: 0,
        failedTargets: 0,
        topReason: null,
        reasons: [],
      },
      retries: {
        retriedTargets: 1,
        highestAttempt: 2,
        hotspotChannelId: 'ch-1',
        hotspotRetryCount: 1,
      },
      audit: {
        totalEvents: 14,
        byType: { launch_campaign: 2, retry_target: 1, mark_ready: 1, clone_campaign: 1, delete_campaign: 1, update_campaign: 1, remove_target: 1, update_target: 1, add_target: 1, add_targets_bulk: 1, publish_completed: 1, publish_failed: 1, publish_partial_failure: 1 },
        lastEventAt: '2026-04-10T12:30:00Z',
        lastEventType: 'delete_campaign',
        lastActorEmail: 'ops@test.com',
      },
      reauth: { blockedCampaigns: 0, blockedTargets: 0, blockedChannelCount: 0, blockedChannelIds: [] },
      channels: [],
    };

    const view = buildDashboardView(data);

    expect(view.auditSummary).toEqual({
        totalEvents: 14,
      launchCampaigns: 2,
      retryTargets: 1,
      markReadyCampaigns: 1,
      clonedCampaigns: 1,
      deletedCampaigns: 1,
      updatedCampaigns: 1,
      removedTargets: 1,
      updatedTargets: 1,
      addedTargets: 1,
      bulkTargetAdds: 1,
      completedPublishes: 1,
      failedPublishes: 1,
      partialFailedPublishes: 1,
      lastEventAt: '2026-04-10T12:30:00Z',
      lastEventType: 'delete_campaign',
      lastActorEmail: 'ops@test.com',
      primaryAction: {
        kind: 'review_campaigns',
        href: '/workspace/campanhas',
      },
    });
    expect(view.auditBanner).toEqual({
      tone: 'neutral',
      title: 'Campaign activity is being recorded',
      body: '14 campaign actions have been recorded. Latest action: delete_campaign by ops@test.com.',
      totalEvents: 14,
      launchCampaigns: 2,
      retryTargets: 1,
      markReadyCampaigns: 1,
      clonedCampaigns: 1,
      deletedCampaigns: 1,
      updatedCampaigns: 1,
      removedTargets: 1,
      updatedTargets: 1,
      addedTargets: 1,
      bulkTargetAdds: 1,
      completedPublishes: 1,
      failedPublishes: 1,
      partialFailedPublishes: 1,
      lastEventAt: '2026-04-10T12:30:00Z',
      lastEventType: 'delete_campaign',
      lastActorEmail: 'ops@test.com',
      primaryAction: {
        kind: 'review_campaigns',
        href: '/workspace/campanhas',
      },
    });
  });
});
