import { describe, expect, test } from 'vitest';

import {
  buildCampaignsPageView,
} from '../../apps/web/app/(admin)/workspace/campanhas/page';
import {
  buildCampaignDetailPageView,
} from '../../apps/web/app/(admin)/workspace/campanhas/detail-page';

import {
  buildCampaignDetailView,
  type CampaignDetailData,
} from '../../apps/web/components/campaigns/campaign-detail';

import {
  buildCampaignListView,
  type CampaignListRow,
} from '../../apps/web/components/campaigns/campaign-list';

describe('campaign list shows scheduled badge', () => {
  test('row includes scheduledAt and displays schedule badge', () => {
    const row: CampaignListRow = {
      id: 'c1',
      title: 'Scheduled Campaign',
      videoAssetName: 'intro.mp4',
      targetCount: 2,
      status: 'ready',
      createdAt: '2026-04-01T00:00:00Z',
      scheduledAt: '2026-04-10T15:00:00Z',
    };

    const view = buildCampaignListView({ rows: [row] });
    expect(view.rows[0].scheduledAt).toBe('2026-04-10T15:00:00Z');
    expect(view.rows[0].readyState).toBe('scheduled');
    expect(view.rows[0].schedulePosition).toBe(1);
    expect(view.rows[0].reviewScheduleHref).toBe('/workspace/campanhas/c1');
    expect(view.rows[0].primaryAction).toEqual({
      kind: 'review_schedule',
      href: '/workspace/campanhas/c1',
    });
  });

  test('row includes a detailHref to the campaign detail route', () => {
    const row: CampaignListRow = {
      id: 'c1',
      title: 'Scheduled Campaign',
      videoAssetName: 'intro.mp4',
      targetCount: 2,
      status: 'ready',
      createdAt: '2026-04-01T00:00:00Z',
    };

    const view = buildCampaignListView({ rows: [row] });
    expect(view.rows[0].detailHref).toBe('/workspace/campanhas/c1');
    expect(view.rows[0].cloneHref).toBe('/api/campaigns/c1/clone');
    expect(view.rows[0].deleteHref).toBe('/api/campaigns/c1');
  });

  test('row without scheduledAt has no schedule badge', () => {
    const row: CampaignListRow = {
      id: 'c1',
      title: 'Immediate',
      videoAssetName: 'intro.mp4',
      targetCount: 1,
      status: 'draft',
      createdAt: '2026-04-01T00:00:00Z',
    };

    const view = buildCampaignListView({ rows: [row] });
    expect(view.rows[0].scheduledAt).toBeUndefined();
    expect(view.rows[0].cloneHref).toBe('/api/campaigns/c1/clone');
    expect(view.rows[0].deleteHref).toBe('/api/campaigns/c1');
  });

  test('completed rows expose clone but not delete actions', () => {
    const row: CampaignListRow = {
      id: 'c1',
      title: 'Completed Campaign',
      videoAssetName: 'intro.mp4',
      targetCount: 1,
      status: 'completed',
      createdAt: '2026-04-01T00:00:00Z',
    };

    const view = buildCampaignListView({ rows: [row] });
    expect(view.rows[0].cloneHref).toBe('/api/campaigns/c1/clone');
    expect(view.rows[0].deleteHref).toBeUndefined();
  });

  test('rows derive an outcomeSummary from per-target final statuses when targets are available', () => {
    const row: CampaignListRow = {
      id: 'c1',
      title: 'History Campaign',
      videoAssetName: 'intro.mp4',
      targetCount: 3,
      status: 'completed',
      createdAt: '2026-04-01T00:00:00Z',
      targets: [
        {
          status: 'publicado',
          youtubeVideoId: 'yt-1',
          errorMessage: null,
        },
        {
          status: 'erro',
          youtubeVideoId: null,
          errorMessage: 'quotaExceeded',
        },
        {
          status: 'aguardando',
          youtubeVideoId: null,
          errorMessage: null,
        },
      ],
    };

    const view = buildCampaignListView({ rows: [row] });
    expect(view.rows[0].outcomeSummary).toEqual({
      publishedCount: 1,
      failedCount: 1,
      pendingCount: 1,
    });
    expect(view.rows[0].outcomeState).toBe('mixed');
    expect(view.rows[0].outcomeAction).toEqual({
      kind: 'review_mixed_campaign',
      href: '/workspace/campanhas/c1',
    });
    expect(view.rows[0].primaryAction).toEqual({
      kind: 'review_mixed_campaign',
      href: '/workspace/campanhas/c1',
    });
  });

  test('rows derive reauth-required metadata and prefer a reconnect action when targets are blocked by auth', () => {
    const row: CampaignListRow = {
      id: 'c-reauth',
      title: 'Reconnect Needed Campaign',
      videoAssetName: 'intro.mp4',
      targetCount: 2,
      status: 'completed',
      createdAt: '2026-04-01T00:00:00Z',
      targets: [
        {
          status: 'erro',
          youtubeVideoId: null,
          errorMessage: 'REAUTH_REQUIRED',
          reauthRequired: true,
        },
        {
          status: 'publicado',
          youtubeVideoId: 'yt-1',
          errorMessage: null,
        },
      ],
    };

    const view = buildCampaignListView({ rows: [row] });
    expect(view.rows[0].reauthRequiredCount).toBe(1);
    expect(view.rows[0].reauthHref).toBe('/workspace/accounts');
    expect(view.rows[0].primaryAction).toEqual({
      kind: 'reauth_accounts',
      href: '/workspace/accounts',
    });
  });

  test('rows derive an outcomeState for healthy, failed, and pending summaries', () => {
    const rows: CampaignListRow[] = [
      {
        id: 'healthy',
        title: 'Healthy Campaign',
        videoAssetName: 'healthy.mp4',
        targetCount: 1,
        status: 'completed',
        createdAt: '2026-04-01T00:00:00Z',
        targets: [
          { status: 'publicado', youtubeVideoId: 'yt-1', errorMessage: null },
        ],
      },
      {
        id: 'failed',
        title: 'Failed Campaign',
        videoAssetName: 'failed.mp4',
        targetCount: 1,
        status: 'completed',
        createdAt: '2026-04-01T00:00:00Z',
        targets: [
          { status: 'erro', youtubeVideoId: null, errorMessage: 'quotaExceeded' },
        ],
      },
      {
        id: 'pending',
        title: 'Pending Campaign',
        videoAssetName: 'pending.mp4',
        targetCount: 1,
        status: 'completed',
        createdAt: '2026-04-01T00:00:00Z',
        targets: [
          { status: 'aguardando', youtubeVideoId: null, errorMessage: null },
        ],
      },
    ];

    const view = buildCampaignListView({ rows });
    expect(view.rows[0].outcomeState).toBe('healthy');
    expect(view.rows[1].outcomeState).toBe('failed');
    expect(view.rows[2].outcomeState).toBe('pending');
    expect(view.rows[0].outcomeAction).toBeUndefined();
    expect(view.rows[1].outcomeAction).toEqual({
      kind: 'review_failed_campaign',
      href: '/workspace/campanhas/failed',
    });
    expect(view.rows[2].outcomeAction).toEqual({
      kind: 'review_pending_campaign',
      href: '/workspace/campanhas/pending',
    });
    expect(view.rows[0].primaryAction).toBeUndefined();
    expect(view.rows[1].primaryAction).toEqual({
      kind: 'review_failed_campaign',
      href: '/workspace/campanhas/failed',
    });
    expect(view.rows[2].primaryAction).toEqual({
      kind: 'review_pending_campaign',
      href: '/workspace/campanhas/pending',
    });
  });

  test('configured draft rows expose a mark-ready action', () => {
    const row: CampaignListRow = {
      id: 'c1',
      title: 'Configured Draft',
      videoAssetName: 'intro.mp4',
      targetCount: 1,
      status: 'draft',
      createdAt: '2026-04-01T00:00:00Z',
    };

    const view = buildCampaignListView({ rows: [row] });
    expect(view.rows[0].markReadyHref).toBe('/api/campaigns/c1/ready');
    expect(view.rows[0].launchHref).toBeUndefined();
    expect(view.rows[0].primaryAction).toEqual({
      kind: 'mark_ready',
      href: '/api/campaigns/c1/ready',
    });
  });

  test('ready rows with targets expose a launch action', () => {
    const row: CampaignListRow = {
      id: 'c1',
      title: 'Ready Campaign',
      videoAssetName: 'intro.mp4',
      targetCount: 2,
      status: 'ready',
      createdAt: '2026-04-01T00:00:00Z',
    };

    const view = buildCampaignListView({ rows: [row] });
    expect(view.rows[0].readyState).toBe('immediate');
    expect(view.rows[0].reviewScheduleHref).toBeUndefined();
    expect(view.rows[0].markReadyHref).toBeUndefined();
    expect(view.rows[0].launchHref).toBe('/api/campaigns/c1/launch');
    expect(view.rows[0].primaryAction).toEqual({
      kind: 'launch_campaign',
      href: '/api/campaigns/c1/launch',
    });
  });

  test('ready rows without targets do not expose a launch action', () => {
    const row: CampaignListRow = {
      id: 'c1',
      title: 'Empty Ready Campaign',
      videoAssetName: 'intro.mp4',
      targetCount: 0,
      status: 'ready',
      createdAt: '2026-04-01T00:00:00Z',
    };

    const view = buildCampaignListView({ rows: [row] });
    expect(view.rows[0].launchHref).toBeUndefined();
  });
});

describe('campaign detail shows retry action for failed targets', () => {
  test('failed target has retryAvailable flag', () => {
    const data: CampaignDetailData = {
      id: 'camp-1',
      title: 'Failed Campaign',
      videoAssetName: 'intro.mp4',
      status: 'failed',
      targets: [
        {
          id: 't1',
          channelTitle: 'Main Channel',
          videoTitle: 'Failed Upload',
          status: 'erro',
          youtubeVideoId: null,
          errorMessage: 'quotaExceeded',
          retryCount: 1,
          maxRetries: 3,
        },
      ],
      createdAt: '2026-04-01T00:00:00Z',
    };

    const view = buildCampaignDetailView(data);
    expect(view.targets[0].retryAvailable).toBe(true);
  });

  test('failed target with max retries has no retry available', () => {
    const data: CampaignDetailData = {
      id: 'camp-1',
      title: 'Exhausted',
      videoAssetName: 'intro.mp4',
      status: 'failed',
      targets: [
        {
          id: 't1',
          channelTitle: 'Main Channel',
          videoTitle: 'Dead Upload',
          status: 'erro',
          youtubeVideoId: null,
          errorMessage: 'quotaExceeded',
          retryCount: 3,
          maxRetries: 3,
        },
      ],
      createdAt: '2026-04-01T00:00:00Z',
    };

    const view = buildCampaignDetailView(data);
    expect(view.targets[0].retryAvailable).toBe(false);
  });

  test('successful targets do not have retry', () => {
    const data: CampaignDetailData = {
      id: 'camp-1',
      title: 'Done',
      videoAssetName: 'intro.mp4',
      status: 'completed',
      targets: [
        {
          id: 't1',
          channelTitle: 'Main Channel',
          videoTitle: 'Published',
          status: 'publicado',
          youtubeVideoId: 'yt-1',
          errorMessage: null,
        },
      ],
      createdAt: '2026-04-01T00:00:00Z',
    };

    const view = buildCampaignDetailView(data);
    expect(view.targets[0].retryAvailable).toBe(false);
  });
});

describe('campaigns page with scheduling info', () => {
  test('shows scheduled campaigns with badge', () => {
    const view = buildCampaignsPageView({
      campaigns: [
        {
          id: 'c1',
          title: 'Scheduled',
          videoAssetName: 'intro.mp4',
          targetCount: 2,
          status: 'ready',
          createdAt: '2026-04-01T00:00:00Z',
          scheduledAt: '2026-04-10T15:00:00Z',
        },
      ],
    });

    expect(view.list.rows[0].scheduledAt).toBe('2026-04-10T15:00:00Z');
  });

  test('surfaces an overview for the next ready scheduled campaign', () => {
    const view = buildCampaignsPageView({
      campaigns: [
        {
          id: 'c1',
          title: 'Already Completed',
          videoAssetName: 'done.mp4',
          targetCount: 1,
          status: 'completed',
          createdAt: '2026-04-01T00:00:00Z',
          scheduledAt: '2026-04-09T15:00:00Z',
        },
        {
          id: 'c2',
          title: 'Scheduled Later',
          videoAssetName: 'later.mp4',
          targetCount: 2,
          status: 'ready',
          createdAt: '2026-04-02T00:00:00Z',
          scheduledAt: '2026-04-12T15:00:00Z',
        },
        {
          id: 'c3',
          title: 'Scheduled Next',
          videoAssetName: 'next.mp4',
          targetCount: 3,
          status: 'ready',
          createdAt: '2026-04-03T00:00:00Z',
          scheduledAt: '2026-04-10T15:00:00Z',
        },
      ],
    });

    expect(view.scheduleOverview).toEqual({
      scheduledCount: 2,
      scheduledCampaignIds: ['c3', 'c2'],
      nextScheduledAt: '2026-04-10T15:00:00Z',
      nextCampaignId: 'c3',
      nextCampaignTitle: 'Scheduled Next',
      nextCampaignHref: '/workspace/campanhas/c3',
      primaryAction: {
        kind: 'review_schedule',
        href: '/workspace/campanhas/c3',
      },
      secondaryAction: {
        kind: 'review_schedule',
        href: '/workspace/campanhas/c2',
      },
    });
    expect(view.scheduleBanner).toEqual({
      tone: 'neutral',
      title: 'Upcoming scheduled campaigns',
      body: '2 ready campaigns are scheduled. Next up: Scheduled Next at 2026-04-10T15:00:00Z.',
      scheduledCount: 2,
      scheduledCampaignIds: ['c3', 'c2'],
      nextScheduledAt: '2026-04-10T15:00:00Z',
      primaryCta: 'Open next scheduled campaign',
      primaryHref: '/workspace/campanhas/c3',
      primaryAction: {
        kind: 'review_schedule',
        href: '/workspace/campanhas/c3',
      },
      secondaryAction: {
        kind: 'review_schedule',
        href: '/workspace/campanhas/c2',
      },
    });
    expect(view.list.rows.find((row) => row.id === 'c1')?.schedulePosition).toBeUndefined();
    expect(view.list.rows.find((row) => row.id === 'c2')?.schedulePosition).toBe(2);
    expect(view.list.rows.find((row) => row.id === 'c3')?.schedulePosition).toBe(1);
  });

  test('campaigns page preserves detailHref for each row', () => {
    const view = buildCampaignsPageView({
      campaigns: [
        {
          id: 'c1',
          title: 'Scheduled',
          videoAssetName: 'intro.mp4',
          targetCount: 2,
          status: 'ready',
          createdAt: '2026-04-01T00:00:00Z',
        },
      ],
    });

    expect(view.list.rows[0].detailHref).toBe('/workspace/campanhas/c1');
    expect(view.list.rows[0].cloneHref).toBe('/api/campaigns/c1/clone');
    expect(view.list.rows[0].deleteHref).toBe('/api/campaigns/c1');
  });

  test('aggregates visible target outcomes into a historyOverview', () => {
    const view = buildCampaignsPageView({
      campaigns: [
        {
          id: 'c1',
          title: 'History Campaign 1',
          videoAssetName: 'intro.mp4',
          targetCount: 2,
          status: 'completed',
          createdAt: '2026-04-01T00:00:00Z',
          targets: [
            { status: 'publicado', youtubeVideoId: 'yt-1', errorMessage: null },
            { status: 'erro', youtubeVideoId: null, errorMessage: 'quotaExceeded' },
          ],
        },
        {
          id: 'c2',
          title: 'History Campaign 2',
          videoAssetName: 'followup.mp4',
          targetCount: 2,
          status: 'completed',
          createdAt: '2026-04-02T00:00:00Z',
          targets: [
            { status: 'publicado', youtubeVideoId: 'yt-2', errorMessage: null },
            { status: 'aguardando', youtubeVideoId: null, errorMessage: null },
          ],
        },
      ],
    });

    expect(view.historyOverview).toEqual({
      campaignsWithOutcomes: 2,
      campaignsWithFailures: 1,
      publishedTargets: 2,
      failedTargets: 1,
      pendingTargets: 1,
      dominantOutcomeState: 'failed',
      outcomeStateCounts: {
        mixed: 0,
        failed: 1,
        pending: 1,
        healthy: 0,
      },
      outcomeStateCampaignIds: {
        mixed: [],
        failed: ['c1'],
        pending: ['c2'],
        healthy: [],
      },
      failureCampaignIds: ['c1'],
      pendingCampaignIds: ['c2'],
      primaryAction: {
        kind: 'review_failed_campaign',
        href: '/workspace/campanhas/c1',
      },
      secondaryAction: {
        kind: 'review_pending_campaign',
        href: '/workspace/campanhas/c2',
      },
    });
    expect(view.historyBanner).toEqual({
      kind: 'failed',
      tone: 'warning',
      title: 'Campaign outcomes need attention',
      body: 'Visible outcomes: 2 published, 1 failed, 1 pending across 2 campaigns.',
      publishedTargets: 2,
      failedTargets: 1,
      pendingTargets: 1,
      outcomeStateCampaignIds: {
        mixed: [],
        failed: ['c1'],
        pending: ['c2'],
        healthy: [],
      },
      failureCampaignIds: ['c1'],
      pendingCampaignIds: ['c2'],
      primaryAction: {
        kind: 'review_failed_campaign',
        href: '/workspace/campanhas/c1',
      },
      secondaryAction: {
        kind: 'review_pending_campaign',
        href: '/workspace/campanhas/c2',
      },
    });
  });

  test('surfaces a reauth overview and banner when visible campaigns are blocked by account reconnect', () => {
    const view = buildCampaignsPageView({
      campaigns: [
        {
          id: 'c-reauth-1',
          title: 'Reconnect Needed Campaign 1',
          videoAssetName: 'intro.mp4',
          targetCount: 2,
          status: 'completed',
          createdAt: '2026-04-01T00:00:00Z',
          targets: [
            { status: 'erro', youtubeVideoId: null, errorMessage: 'REAUTH_REQUIRED', reauthRequired: true },
            { status: 'publicado', youtubeVideoId: 'yt-1', errorMessage: null },
          ],
        },
        {
          id: 'c-reauth-2',
          title: 'Reconnect Needed Campaign 2',
          videoAssetName: 'followup.mp4',
          targetCount: 1,
          status: 'failed',
          createdAt: '2026-04-02T00:00:00Z',
          targets: [
            { status: 'erro', youtubeVideoId: null, errorMessage: 'REAUTH_REQUIRED', reauthRequired: true },
          ],
        },
      ],
    });

    expect(view.reauthOverview).toEqual({
      blockedCampaignCount: 2,
      blockedTargetCount: 2,
      blockedCampaignIds: ['c-reauth-1', 'c-reauth-2'],
      primaryAction: {
        kind: 'reauth_accounts',
        href: '/workspace/accounts',
      },
    });
    expect(view.reauthBanner).toEqual({
      tone: 'warning',
      title: 'Campaigns blocked by account reauthorization',
      body: '2 campaigns include 2 targets waiting for account reauthorization.',
      blockedCampaignCount: 2,
      blockedTargetCount: 2,
      blockedCampaignIds: ['c-reauth-1', 'c-reauth-2'],
      primaryAction: {
        kind: 'reauth_accounts',
        href: '/workspace/accounts',
      },
    });
  });

  test('uses a pending-only outcome CTA when no visible campaign has failures', () => {
    const view = buildCampaignsPageView({
      campaigns: [
        {
          id: 'c1',
          title: 'Pending Campaign 1',
          videoAssetName: 'intro.mp4',
          targetCount: 2,
          status: 'completed',
          createdAt: '2026-04-01T00:00:00Z',
          targets: [
            { status: 'publicado', youtubeVideoId: 'yt-1', errorMessage: null },
            { status: 'aguardando', youtubeVideoId: null, errorMessage: null },
          ],
        },
        {
          id: 'c2',
          title: 'Pending Campaign 2',
          videoAssetName: 'followup.mp4',
          targetCount: 1,
          status: 'completed',
          createdAt: '2026-04-02T00:00:00Z',
          targets: [
            { status: 'aguardando', youtubeVideoId: null, errorMessage: null },
          ],
        },
      ],
    });

    expect(view.historyOverview).toEqual({
      campaignsWithOutcomes: 2,
      campaignsWithFailures: 0,
      publishedTargets: 1,
      failedTargets: 0,
      pendingTargets: 2,
      dominantOutcomeState: 'pending',
      outcomeStateCounts: {
        mixed: 0,
        failed: 0,
        pending: 2,
        healthy: 0,
      },
      outcomeStateCampaignIds: {
        mixed: [],
        failed: [],
        pending: ['c1', 'c2'],
        healthy: [],
      },
      failureCampaignIds: [],
      pendingCampaignIds: ['c1', 'c2'],
      primaryAction: {
        kind: 'review_pending_campaign',
        href: '/workspace/campanhas/c1',
      },
      secondaryAction: {
        kind: 'review_pending_campaign',
        href: '/workspace/campanhas/c2',
      },
    });
    expect(view.historyBanner).toEqual({
      kind: 'pending',
      tone: 'neutral',
      title: 'Campaign outcomes are still in motion',
      body: 'Visible outcomes: 1 published, 0 failed, 2 pending across 2 campaigns.',
      publishedTargets: 1,
      failedTargets: 0,
      pendingTargets: 2,
      outcomeStateCampaignIds: {
        mixed: [],
        failed: [],
        pending: ['c1', 'c2'],
        healthy: [],
      },
      failureCampaignIds: [],
      pendingCampaignIds: ['c1', 'c2'],
      primaryAction: {
        kind: 'review_pending_campaign',
        href: '/workspace/campanhas/c1',
      },
      secondaryAction: {
        kind: 'review_pending_campaign',
        href: '/workspace/campanhas/c2',
      },
    });
  });

  test('uses a failed-only outcome CTA when no visible campaign is pending', () => {
    const view = buildCampaignsPageView({
      campaigns: [
        {
          id: 'c1',
          title: 'Failed Campaign 1',
          videoAssetName: 'intro.mp4',
          targetCount: 2,
          status: 'completed',
          createdAt: '2026-04-01T00:00:00Z',
          targets: [
            { status: 'publicado', youtubeVideoId: 'yt-1', errorMessage: null },
            { status: 'erro', youtubeVideoId: null, errorMessage: 'quotaExceeded' },
          ],
        },
        {
          id: 'c2',
          title: 'Failed Campaign 2',
          videoAssetName: 'followup.mp4',
          targetCount: 1,
          status: 'completed',
          createdAt: '2026-04-02T00:00:00Z',
          targets: [
            { status: 'erro', youtubeVideoId: null, errorMessage: 'processingError' },
          ],
        },
      ],
    });

    expect(view.historyOverview).toEqual({
      campaignsWithOutcomes: 2,
      campaignsWithFailures: 2,
      publishedTargets: 1,
      failedTargets: 2,
      pendingTargets: 0,
      dominantOutcomeState: 'failed',
      outcomeStateCounts: {
        mixed: 0,
        failed: 2,
        pending: 0,
        healthy: 0,
      },
      outcomeStateCampaignIds: {
        mixed: [],
        failed: ['c1', 'c2'],
        pending: [],
        healthy: [],
      },
      failureCampaignIds: ['c1', 'c2'],
      pendingCampaignIds: [],
      primaryAction: {
        kind: 'review_failed_campaign',
        href: '/workspace/campanhas/c1',
      },
      secondaryAction: {
        kind: 'review_failed_campaign',
        href: '/workspace/campanhas/c2',
      },
    });
    expect(view.historyBanner).toEqual({
      kind: 'failed',
      tone: 'warning',
      title: 'Campaign outcomes need attention',
      body: 'Visible outcomes: 1 published, 2 failed, 0 pending across 2 campaigns.',
      publishedTargets: 1,
      failedTargets: 2,
      pendingTargets: 0,
      outcomeStateCampaignIds: {
        mixed: [],
        failed: ['c1', 'c2'],
        pending: [],
        healthy: [],
      },
      failureCampaignIds: ['c1', 'c2'],
      pendingCampaignIds: [],
      primaryAction: {
        kind: 'review_failed_campaign',
        href: '/workspace/campanhas/c1',
      },
      secondaryAction: {
        kind: 'review_failed_campaign',
        href: '/workspace/campanhas/c2',
      },
    });
  });

  test('shows a healthy outcome summary when no visible campaign has failures or pending targets', () => {
    const view = buildCampaignsPageView({
      campaigns: [
        {
          id: 'c1',
          title: 'Healthy Campaign 1',
          videoAssetName: 'intro.mp4',
          targetCount: 1,
          status: 'completed',
          createdAt: '2026-04-01T00:00:00Z',
          targets: [
            { status: 'publicado', youtubeVideoId: 'yt-1', errorMessage: null },
          ],
        },
        {
          id: 'c2',
          title: 'Healthy Campaign 2',
          videoAssetName: 'followup.mp4',
          targetCount: 2,
          status: 'completed',
          createdAt: '2026-04-02T00:00:00Z',
          targets: [
            { status: 'publicado', youtubeVideoId: 'yt-2', errorMessage: null },
            { status: 'publicado', youtubeVideoId: 'yt-3', errorMessage: null },
          ],
        },
      ],
    });

    expect(view.historyOverview).toEqual({
      campaignsWithOutcomes: 2,
      campaignsWithFailures: 0,
      publishedTargets: 3,
      failedTargets: 0,
      pendingTargets: 0,
      dominantOutcomeState: 'healthy',
      outcomeStateCounts: {
        mixed: 0,
        failed: 0,
        pending: 0,
        healthy: 2,
      },
      outcomeStateCampaignIds: {
        mixed: [],
        failed: [],
        pending: [],
        healthy: ['c1', 'c2'],
      },
      failureCampaignIds: [],
      pendingCampaignIds: [],
      primaryAction: undefined,
      secondaryAction: undefined,
    });
    expect(view.historyBanner).toEqual({
      kind: 'healthy',
      tone: 'success',
      title: 'Campaign outcomes look healthy',
      body: 'Visible outcomes: 3 published, 0 failed, 0 pending across 2 campaigns.',
      publishedTargets: 3,
      failedTargets: 0,
      pendingTargets: 0,
      outcomeStateCampaignIds: {
        mixed: [],
        failed: [],
        pending: [],
        healthy: ['c1', 'c2'],
      },
      failureCampaignIds: [],
      pendingCampaignIds: [],
      primaryAction: undefined,
      secondaryAction: undefined,
    });
  });

  test('aggregates outcomeState distribution across visible campaigns', () => {
    const view = buildCampaignsPageView({
      campaigns: [
        {
          id: 'failed',
          title: 'Failed Campaign',
          videoAssetName: 'failed.mp4',
          targetCount: 1,
          status: 'completed',
          createdAt: '2026-04-02T00:00:00Z',
          targets: [
            { status: 'erro', youtubeVideoId: null, errorMessage: 'processingError' },
          ],
        },
        {
          id: 'mixed',
          title: 'Mixed Campaign',
          videoAssetName: 'mixed.mp4',
          targetCount: 3,
          status: 'completed',
          createdAt: '2026-04-01T00:00:00Z',
          targets: [
            { status: 'publicado', youtubeVideoId: 'yt-1', errorMessage: null },
            { status: 'erro', youtubeVideoId: null, errorMessage: 'quotaExceeded' },
            { status: 'aguardando', youtubeVideoId: null, errorMessage: null },
          ],
        },
        {
          id: 'pending',
          title: 'Pending Campaign',
          videoAssetName: 'pending.mp4',
          targetCount: 1,
          status: 'completed',
          createdAt: '2026-04-03T00:00:00Z',
          targets: [
            { status: 'aguardando', youtubeVideoId: null, errorMessage: null },
          ],
        },
        {
          id: 'healthy',
          title: 'Healthy Campaign',
          videoAssetName: 'healthy.mp4',
          targetCount: 1,
          status: 'completed',
          createdAt: '2026-04-04T00:00:00Z',
          targets: [
            { status: 'publicado', youtubeVideoId: 'yt-2', errorMessage: null },
          ],
        },
      ],
    });

    expect(view.historyOverview?.outcomeStateCounts).toEqual({
      mixed: 1,
      failed: 1,
      pending: 1,
      healthy: 1,
    });
    expect(view.historyOverview?.outcomeStateCampaignIds).toEqual({
      mixed: ['mixed'],
      failed: ['failed'],
      pending: ['pending'],
      healthy: ['healthy'],
    });
    expect(view.historyBanner?.outcomeStateCampaignIds).toEqual({
      mixed: ['mixed'],
      failed: ['failed'],
      pending: ['pending'],
      healthy: ['healthy'],
    });
    expect(view.historyOverview?.dominantOutcomeState).toBe('mixed');
    expect(view.historyBanner?.kind).toBe('mixed');
    expect(view.historyOverview?.primaryAction).toEqual({
      kind: 'review_mixed_campaign',
      href: '/workspace/campanhas/mixed',
    });
    expect(view.historyOverview?.secondaryAction).toEqual({
      kind: 'review_failed_campaign',
      href: '/workspace/campanhas/failed',
    });
    expect(view.historyBanner?.primaryAction).toEqual({
      kind: 'review_mixed_campaign',
      href: '/workspace/campanhas/mixed',
    });
    expect(view.historyBanner?.secondaryAction).toEqual({
      kind: 'review_failed_campaign',
      href: '/workspace/campanhas/failed',
    });
  });

  test('uses a mixed secondary outcome CTA when multiple mixed campaigns are visible', () => {
    const view = buildCampaignsPageView({
      campaigns: [
        {
          id: 'mixed-1',
          title: 'Mixed Campaign 1',
          videoAssetName: 'mixed-1.mp4',
          targetCount: 3,
          status: 'completed',
          createdAt: '2026-04-01T00:00:00Z',
          targets: [
            { status: 'publicado', youtubeVideoId: 'yt-1', errorMessage: null },
            { status: 'erro', youtubeVideoId: null, errorMessage: 'quotaExceeded' },
            { status: 'aguardando', youtubeVideoId: null, errorMessage: null },
          ],
        },
        {
          id: 'mixed-2',
          title: 'Mixed Campaign 2',
          videoAssetName: 'mixed-2.mp4',
          targetCount: 2,
          status: 'completed',
          createdAt: '2026-04-02T00:00:00Z',
          targets: [
            { status: 'erro', youtubeVideoId: null, errorMessage: 'processingError' },
            { status: 'aguardando', youtubeVideoId: null, errorMessage: null },
          ],
        },
        {
          id: 'healthy',
          title: 'Healthy Campaign',
          videoAssetName: 'healthy.mp4',
          targetCount: 1,
          status: 'completed',
          createdAt: '2026-04-03T00:00:00Z',
          targets: [
            { status: 'publicado', youtubeVideoId: 'yt-2', errorMessage: null },
          ],
        },
      ],
    });

    expect(view.historyOverview?.dominantOutcomeState).toBe('mixed');
    expect(view.historyOverview?.primaryAction).toEqual({
      kind: 'review_mixed_campaign',
      href: '/workspace/campanhas/mixed-1',
    });
    expect(view.historyOverview?.secondaryAction).toEqual({
      kind: 'review_mixed_campaign',
      href: '/workspace/campanhas/mixed-2',
    });
    expect(view.historyBanner?.primaryAction).toEqual({
      kind: 'review_mixed_campaign',
      href: '/workspace/campanhas/mixed-1',
    });
    expect(view.historyBanner?.secondaryAction).toEqual({
      kind: 'review_mixed_campaign',
      href: '/workspace/campanhas/mixed-2',
    });
  });
});

describe('campaign detail page composition', () => {
  test('merges live status into the detail view and surfaces post-upload review links', () => {
    const view = buildCampaignDetailPageView({
      campaign: {
        id: 'camp-1',
        title: 'Partial Failure Campaign',
        videoAssetName: 'intro.mp4',
        status: 'launching',
        createdAt: '2026-04-01T00:00:00Z',
        targets: [
          {
            id: 't1',
            channelTitle: 'Main Channel',
            videoTitle: 'Upload',
            status: 'aguardando',
            youtubeVideoId: null,
            errorMessage: null,
          },
        ],
      },
      liveStatus: {
        campaignId: 'camp-1',
        campaignStatus: 'failed',
        shouldPoll: false,
        progress: { completed: 0, failed: 1, total: 1 },
        targets: [
          {
            targetId: 't1',
            channelId: 'ch-1',
            videoTitle: 'Upload',
            status: 'erro',
            youtubeVideoId: 'yt-partial-123',
            errorMessage: 'Video uploaded as yt-partial-123, but adding it to playlist failed: forbidden',
            latestJobStatus: 'failed',
            hasPostUploadWarning: true,
            reviewYoutubeUrl: 'https://www.youtube.com/watch?v=yt-partial-123',
          },
        ],
      },
      targetJobs: {
        t1: [
          {
            id: 'job-1',
            campaignTargetId: 't1',
            status: 'failed',
            attempt: 1,
            progressPercent: 100,
            youtubeVideoId: 'yt-partial-123',
            errorMessage: 'Video uploaded as yt-partial-123, but adding it to playlist failed: forbidden',
            startedAt: '2026-04-01T00:01:00Z',
            completedAt: null,
            createdAt: '2026-04-01T00:00:00Z',
          },
        ],
      },
    });

    expect(view.detail.header.status).toBe('failed');
    expect(view.detail.targets[0].status).toBe('erro');
    expect(view.detail.targets[0].partialFailureYoutubeUrl).toBe('https://www.youtube.com/watch?v=yt-partial-123');
    expect(view.polling.enabled).toBe(false);
    expect(view.postUploadWarnings).toMatchObject({
      count: 1,
      targetIds: ['t1'],
    });
    expect(view.targetHistory).toEqual([
      {
        targetId: 't1',
        jobs: [
          {
            id: 'job-1',
            status: 'failed',
            attempt: 1,
            startedAt: '2026-04-01T00:01:00Z',
            completedAt: null,
            errorMessage: 'Video uploaded as yt-partial-123, but adding it to playlist failed: forbidden',
            youtubeVideoId: 'yt-partial-123',
          },
        ],
      },
    ]);
  });

  test('falls back to static detail data when live status is unavailable', () => {
    const view = buildCampaignDetailPageView({
      campaign: {
        id: 'camp-1',
        title: 'Launching Campaign',
        videoAssetName: 'intro.mp4',
        status: 'launching',
        createdAt: '2026-04-01T00:00:00Z',
        targets: [
          {
            id: 't1',
            channelTitle: 'Main Channel',
            videoTitle: 'Upload',
            status: 'enviando',
            youtubeVideoId: null,
            errorMessage: null,
          },
        ],
      },
    });

    expect(view.detail.header.status).toBe('launching');
    expect(view.polling.enabled).toBe(true);
    expect(view.postUploadWarnings).toBeUndefined();
  });
});
