import { describe, expect, test, vi } from 'vitest';

import {
  buildCampaignsPageView,
} from '../../apps/web/app/(admin)/workspace/campanhas/page';
import {
  buildCampaignsPage,
} from '../../apps/web/app/(admin)/workspace/campanhas/page';
import {
  buildCampaignDetailPage,
} from '../../apps/web/app/(admin)/workspace/campanhas/detail-page';
import {
  buildCampaignDetailRoute,
} from '../../apps/web/app/(admin)/workspace/campanhas/[campaignId]/page';
import {
  buildCampaignComposerRoute,
  buildCampaignComposerRouteActions,
  buildCampaignComposerRouteErrorState,
  buildCampaignComposerRouteView,
  buildCampaignComposerRouteStatus,
  buildCampaignComposerSubmitView,
  buildCampaignComposerSubmitStatus,
  buildCampaignComposerSubmitErrorState,
  buildCampaignComposerSubmitModel,
  buildCampaignComposerSubmitSuccessState,
  submitCampaignComposerRouteDraft,
} from '../../apps/web/app/(admin)/workspace/campanhas/nova/page';
import type { CampaignListRow } from '../../apps/web/components/campaigns/campaign-list';
import type { AuthFetch, AuthFetchResponse } from '../../apps/web/lib/auth-client';

function mockFetcher(responses: Record<string, { status: number; body: unknown }>): AuthFetch {
  return async (url: string, init?: any): Promise<AuthFetchResponse> => {
    const key = `${init?.method ?? 'GET'} ${url}`;
    const match = Object.entries(responses).find(([pattern]) => {
      if (pattern === key) return true;
      const regex = new RegExp('^' + pattern.replace(/:[\w]+/g, '[^/]+') + '$');
      return regex.test(key);
    });

    const resp = match?.[1] ?? { status: 404, body: { error: 'Not found' } };
    return {
      status: resp.status,
      json: async () => resp.body,
    };
  };
}

function createJsonResponse(status: number, body: unknown): AuthFetchResponse {
  return {
    status,
    json: async () => body,
  };
}

describe('campanhas page integration with API shapes', () => {
  test('maps API campaign list to page view', () => {
    // Simulates what the page would receive after fetching from /api/campaigns
    const apiResponse: CampaignListRow[] = [
      {
        id: 'c1',
        title: 'My First Campaign',
        videoAssetName: 'intro.mp4',
        targetCount: 3,
        status: 'completed',
        createdAt: '2026-04-01T00:00:00Z',
        scheduledAt: '2026-04-05T10:00:00Z',
      },
      {
        id: 'c2',
        title: 'Draft Campaign',
        videoAssetName: 'demo.mp4',
        targetCount: 0,
        status: 'draft',
        createdAt: '2026-04-02T00:00:00Z',
      },
      {
        id: 'c3',
        title: 'Configured Draft Campaign',
        videoAssetName: 'prepared.mp4',
        targetCount: 1,
        status: 'draft',
        createdAt: '2026-04-03T00:00:00Z',
      },
      {
        id: 'c4',
        title: 'Ready Campaign',
        videoAssetName: 'launch.mp4',
        targetCount: 2,
        status: 'ready',
        createdAt: '2026-04-04T00:00:00Z',
      },
    ];

    const view = buildCampaignsPageView({ campaigns: apiResponse });

    expect(view.list.rows).toHaveLength(4);
    expect(view.list.isEmpty).toBe(false);
    expect(view.emptyState).toBeUndefined();
    expect(view.list.rows[0].detailHref).toBe('/workspace/campanhas/c1');
    expect(view.list.rows[1].detailHref).toBe('/workspace/campanhas/c2');
    expect(view.list.rows[0].cloneHref).toBe('/api/campaigns/c1/clone');
    expect(view.list.rows[0].deleteHref).toBeUndefined();
    expect(view.list.rows[1].cloneHref).toBe('/api/campaigns/c2/clone');
    expect(view.list.rows[1].deleteHref).toBe('/api/campaigns/c2');
    expect(view.list.rows[2].markReadyHref).toBe('/api/campaigns/c3/ready');
    expect(view.list.rows[2].launchHref).toBeUndefined();
    expect(view.list.rows[2].primaryAction).toEqual({
      kind: 'mark_ready',
      href: '/api/campaigns/c3/ready',
    });
    expect(view.list.rows[3].markReadyHref).toBeUndefined();
    expect(view.list.rows[3].launchHref).toBe('/api/campaigns/c4/launch');
    expect(view.list.rows[3].primaryAction).toEqual({
      kind: 'launch_campaign',
      href: '/api/campaigns/c4/launch',
    });

    // Scheduled campaign preserves scheduledAt
    expect(view.list.rows[0].scheduledAt).toBe('2026-04-05T10:00:00Z');
    expect(view.list.rows[0].readyState).toBeUndefined();
    expect(view.list.rows[3].reviewScheduleHref).toBeUndefined();
    // Non-scheduled has no scheduledAt
    expect(view.list.rows[1].scheduledAt).toBeUndefined();
    expect(view.list.rows[3].readyState).toBe('immediate');
    expect(view.list.rows[0].reviewScheduleHref).toBeUndefined();
  });

  test('buildCampaignsPage surfaces reauth overview when API rows include blocked targets', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns': {
        status: 200,
        body: {
          campaigns: [
            {
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
            },
          ],
          total: 1,
          limit: 20,
          offset: 0,
        },
      },
    });

    const view = await buildCampaignsPage({ fetcher });

    expect(view.error).toBeUndefined();
    expect(view.page?.list.rows[0]).toMatchObject({
      reauthRequiredCount: 1,
      reauthHref: '/workspace/accounts',
      primaryAction: {
        kind: 'reauth_accounts',
        href: '/workspace/accounts',
      },
    });
    expect(view.page?.reauthOverview).toEqual({
      blockedCampaignCount: 1,
      blockedTargetCount: 1,
      blockedCampaignIds: ['c-reauth'],
      primaryAction: {
        kind: 'reauth_accounts',
        href: '/workspace/accounts',
      },
    });
    expect(view.page?.reauthBanner).toEqual({
      tone: 'warning',
      title: 'Campaigns blocked by account reauthorization',
      body: '1 campaign includes 1 target waiting for account reauthorization.',
      blockedCampaignCount: 1,
      blockedTargetCount: 1,
      blockedCampaignIds: ['c-reauth'],
      primaryAction: {
        kind: 'reauth_accounts',
        href: '/workspace/accounts',
      },
    });
  });

  test('scheduled ready rows expose an explicit reviewScheduleHref in the list', () => {
    const view = buildCampaignsPageView({
      campaigns: [
        {
          id: 'c-scheduled',
          title: 'Scheduled Ready Campaign',
          videoAssetName: 'intro.mp4',
          targetCount: 2,
          status: 'ready',
          createdAt: '2026-04-01T00:00:00Z',
          scheduledAt: '2026-04-10T15:00:00Z',
        },
      ],
    });

    expect(view.list.rows[0]).toMatchObject({
      readyState: 'scheduled',
      detailHref: '/workspace/campanhas/c-scheduled',
      reviewScheduleHref: '/workspace/campanhas/c-scheduled',
      launchHref: '/api/campaigns/c-scheduled/launch',
      primaryAction: {
        kind: 'review_schedule',
        href: '/workspace/campanhas/c-scheduled',
      },
    });
  });

  test('shows empty state when no campaigns from API', () => {
    const view = buildCampaignsPageView({ campaigns: [] });

    expect(view.actions).toEqual({
      createHref: '/workspace/campanhas/nova',
      createLabel: 'Create campaign',
    });
    expect(view.list.isEmpty).toBe(true);
    expect(view.emptyState).toBeDefined();
    expect(view.emptyState!.cta).toBe('Create campaign');
    expect(view.emptyState!.ctaHref).toBe('/workspace/campanhas/nova');
  });

  test('buildCampaignsPage keeps create campaign navigation available even when rows exist', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns': {
        status: 200,
        body: {
          campaigns: [
            {
              id: 'c1',
              title: 'Existing Campaign',
              videoAssetName: 'intro.mp4',
              targetCount: 1,
              status: 'draft',
              createdAt: '2026-04-01T00:00:00Z',
            },
          ],
          total: 1,
          limit: 20,
          offset: 0,
        },
      },
    });

    const view = await buildCampaignsPage({ fetcher });

    expect(view.error).toBeUndefined();
    expect(view.page?.actions).toEqual({
      createHref: '/workspace/campanhas/nova',
      createLabel: 'Create campaign',
    });
    expect(view.page?.list.rows).toHaveLength(1);
  });

  test('buildCampaignComposerRoute loads available videos and active channels for the wizard', async () => {
    const fetcher = mockFetcher({
      'GET /api/media': {
        status: 200,
        body: {
          assets: [
            {
              id: 'video-1',
              asset_type: 'video',
              original_name: 'intro.mp4',
              duration_seconds: 120,
            },
            {
              id: 'video-2',
              asset_type: 'video',
              original_name: 'launch.mp4',
              duration_seconds: 45,
            },
          ],
        },
      },
      'GET /api/accounts': {
        status: 200,
        body: {
          accounts: [
            { id: 'acct-1' },
            { id: 'acct-2' },
          ],
        },
      },
      'GET /api/accounts/acct-1/channels': {
        status: 200,
        body: {
          channels: [
            {
              id: 'ch-1',
              title: 'Main Channel',
              thumbnailUrl: 'https://img.test/main.jpg',
              isActive: true,
            },
            {
              id: 'ch-2',
              title: 'Hidden Channel',
              thumbnailUrl: null,
              isActive: false,
            },
          ],
        },
      },
      'GET /api/accounts/acct-2/channels': {
        status: 200,
        body: {
          channels: [
            {
              id: 'ch-3',
              title: 'Backup Channel',
              thumbnailUrl: null,
              isActive: true,
            },
          ],
        },
      },
    });

    const view = await buildCampaignComposerRoute({ fetcher });

    expect(view.route).toBe('/workspace/campanhas/nova');
    expect(view.backHref).toBe('/workspace/campanhas');
    expect(view.loadState).toBe('ready');
    expect(view.blockingReason).toBeUndefined();
    expect(view.loadMessage).toBe('Campaign composer is ready');
    expect(view.statusKind).toBe('ready');
    expect(view.statusTone).toBe('neutral');
    expect(view.statusMessage).toBe('Campaign composer is ready');
    expect(view.statusDetail).toBe('Videos and active channels are available.');
    expect(view.ctaLayout).toBe('primary_secondary');
    expect(view.primaryCta).toEqual({
      kind: 'save_draft',
      label: 'Save draft',
      pendingLabel: 'Saving draft...',
    });
    expect(view.secondaryCta).toEqual({
      kind: 'cancel_composer',
      label: 'Cancel',
      href: '/workspace/campanhas',
    });
    expect(view.actions).toEqual({
      cancelHref: '/workspace/campanhas',
      submitDraft: {
        kind: 'save_draft',
        label: 'Save draft',
        pendingLabel: 'Saving draft...',
        successRedirectPattern: '/workspace/campanhas/:campaignId',
        disabledState: undefined,
        disabledReason: undefined,
      },
    });
    expect(view.page?.summary).toEqual({
      availableVideoCount: 2,
      availableChannelCount: 3,
      activeChannelCount: 2,
    });
    expect(view.page?.actions).toEqual({
      cancelHref: '/workspace/campanhas',
      saveDraftLabel: 'Save draft',
    });
    expect(view.page?.wizard.steps[0].videos).toEqual([
      { id: 'video-1', original_name: 'intro.mp4', duration_seconds: 120 },
      { id: 'video-2', original_name: 'launch.mp4', duration_seconds: 45 },
    ]);
    expect(view.page?.wizard.steps[1].channels).toEqual([
      { id: 'ch-1', title: 'Main Channel', thumbnailUrl: 'https://img.test/main.jpg', isActive: true },
      { id: 'ch-3', title: 'Backup Channel', thumbnailUrl: null, isActive: true },
    ]);
    expect(view.page?.emptyState).toBeUndefined();
  });

  test('buildCampaignComposerRoute disables submit action when no active channels are available', async () => {
    const fetcher = mockFetcher({
      'GET /api/media': {
        status: 200,
        body: {
          assets: [
            {
              id: 'video-1',
              asset_type: 'video',
              original_name: 'intro.mp4',
              duration_seconds: 120,
            },
          ],
        },
      },
      'GET /api/accounts': {
        status: 200,
        body: {
          accounts: [
            { id: 'acct-1' },
          ],
        },
      },
      'GET /api/accounts/acct-1/channels': {
        status: 200,
        body: {
          channels: [
            {
              id: 'ch-1',
              title: 'Dormant Channel',
              thumbnailUrl: null,
              isActive: false,
            },
          ],
        },
      },
    });

    const view = await buildCampaignComposerRoute({ fetcher });

    expect(view.loadState).toBe('blocked');
    expect(view.blockingReason).toBe('missing_active_channels');
    expect(view.loadMessage).toBe('No active channels available');
    expect(view.statusKind).toBe('blocked');
    expect(view.statusTone).toBe('warning');
    expect(view.statusMessage).toBe('No active channels available');
    expect(view.statusDetail).toBe('Activate at least one YouTube channel before creating a campaign.');
    expect(view.ctaLayout).toBe('primary_secondary');
    expect(view.primaryCta).toEqual({
      kind: 'manage_channels',
      label: 'Manage channels',
      href: '/workspace/accounts',
    });
    expect(view.secondaryCta).toEqual({
      kind: 'cancel_composer',
      label: 'Cancel',
      href: '/workspace/campanhas',
    });
    expect(view.actions).toEqual({
      cancelHref: '/workspace/campanhas',
      submitDraft: {
        kind: 'save_draft',
        label: 'Save draft',
        pendingLabel: 'Saving draft...',
        successRedirectPattern: '/workspace/campanhas/:campaignId',
        disabledState: 'missing_active_channels',
        disabledReason: 'No active channels available',
      },
    });
    expect(view.page?.emptyState).toEqual({
      heading: 'No active channels available',
      body: 'Activate at least one YouTube channel before creating a campaign.',
      cta: 'Manage channels',
      ctaHref: '/workspace/accounts',
    });
  });

  test('buildCampaignComposerRoute disables submit action when no videos are available', async () => {
    const fetcher = mockFetcher({
      'GET /api/media': {
        status: 200,
        body: {
          assets: [],
        },
      },
      'GET /api/accounts': {
        status: 200,
        body: {
          accounts: [
            { id: 'acct-1' },
          ],
        },
      },
      'GET /api/accounts/acct-1/channels': {
        status: 200,
        body: {
          channels: [
            {
              id: 'ch-1',
              title: 'Main Channel',
              thumbnailUrl: null,
              isActive: true,
            },
          ],
        },
      },
    });

    const view = await buildCampaignComposerRoute({ fetcher });

    expect(view.loadState).toBe('blocked');
    expect(view.blockingReason).toBe('missing_videos');
    expect(view.loadMessage).toBe('No videos available');
    expect(view.statusKind).toBe('blocked');
    expect(view.statusTone).toBe('warning');
    expect(view.statusMessage).toBe('No videos available');
    expect(view.statusDetail).toBe('Upload a video in Media before creating a campaign.');
    expect(view.ctaLayout).toBe('primary_secondary');
    expect(view.primaryCta).toEqual({
      kind: 'open_media_library',
      label: 'Open media library',
      href: '/workspace/media',
    });
    expect(view.secondaryCta).toEqual({
      kind: 'cancel_composer',
      label: 'Cancel',
      href: '/workspace/campanhas',
    });
    expect(view.actions).toEqual({
      cancelHref: '/workspace/campanhas',
      submitDraft: {
        kind: 'save_draft',
        label: 'Save draft',
        pendingLabel: 'Saving draft...',
        successRedirectPattern: '/workspace/campanhas/:campaignId',
        disabledState: 'missing_videos',
        disabledReason: 'No videos available',
      },
    });
    expect(view.page?.emptyState).toEqual({
      heading: 'No videos available',
      body: 'Upload a video in Media before creating a campaign.',
      cta: 'Open media library',
      ctaHref: '/workspace/media',
    });
  });

  test('buildCampaignComposerRoute exposes an explicit error loadState when composer loading fails', async () => {
    const fetcher = mockFetcher({
      'GET /api/media': {
        status: 500,
        body: {
          error: 'Media service unavailable',
        },
      },
    });

    const view = await buildCampaignComposerRoute({ fetcher });

    expect(view.loadState).toBe('error');
    expect(view.blockingReason).toBeUndefined();
    expect(view.loadMessage).toBe('Media service unavailable');
    expect(view.statusKind).toBe('error');
    expect(view.statusTone).toBe('error');
    expect(view.statusMessage).toBe('Campaign composer unavailable');
    expect(view.statusDetail).toBe('Media service unavailable');
    expect(view.ctaLayout).toBe('primary_only');
    expect(view.primaryCta).toEqual({
      kind: 'back_to_campaigns',
      label: 'Back to campaigns',
      href: '/workspace/campanhas',
    });
    expect(view.secondaryCta).toBeUndefined();
    expect(view.page).toBeUndefined();
    expect(view.errorState).toEqual({
      heading: 'Campaign composer unavailable',
      body: 'Media service unavailable',
      cta: 'Back to campaigns',
    });
  });

  test('buildCampaignComposerRouteStatus maps a ready composer page into a reusable status contract', () => {
    expect(buildCampaignComposerRouteStatus({
      page: {
        wizard: {} as any,
        summary: {
          availableVideoCount: 2,
          availableChannelCount: 3,
          activeChannelCount: 2,
        },
        actions: {
          cancelHref: '/workspace/campanhas',
          saveDraftLabel: 'Save draft',
        },
      },
    })).toEqual({
      loadState: 'ready',
      blockingReason: undefined,
      loadMessage: 'Campaign composer is ready',
      statusKind: 'ready',
      statusTone: 'neutral',
      statusMessage: 'Campaign composer is ready',
      statusDetail: 'Videos and active channels are available.',
      ctaLayout: 'primary_secondary',
      primaryCta: {
        kind: 'save_draft',
        label: 'Save draft',
        pendingLabel: 'Saving draft...',
      },
      secondaryCta: {
        kind: 'cancel_composer',
        label: 'Cancel',
        href: '/workspace/campanhas',
      },
    });
  });

  test('buildCampaignComposerRouteStatus maps a blocked composer page into a reusable status contract', () => {
    expect(buildCampaignComposerRouteStatus({
      page: {
        wizard: {} as any,
        summary: {
          availableVideoCount: 1,
          availableChannelCount: 1,
          activeChannelCount: 0,
        },
        actions: {
          cancelHref: '/workspace/campanhas',
          saveDraftLabel: 'Save draft',
        },
        emptyState: {
          heading: 'No active channels available',
          body: 'Activate at least one YouTube channel before creating a campaign.',
          cta: 'Manage channels',
          ctaHref: '/workspace/accounts',
        },
      },
    })).toEqual({
      loadState: 'blocked',
      blockingReason: 'missing_active_channels',
      loadMessage: 'No active channels available',
      statusKind: 'blocked',
      statusTone: 'warning',
      statusMessage: 'No active channels available',
      statusDetail: 'Activate at least one YouTube channel before creating a campaign.',
      ctaLayout: 'primary_secondary',
      primaryCta: {
        kind: 'manage_channels',
        label: 'Manage channels',
        href: '/workspace/accounts',
      },
      secondaryCta: {
        kind: 'cancel_composer',
        label: 'Cancel',
        href: '/workspace/campanhas',
      },
    });
  });

  test('buildCampaignComposerRouteStatus maps a load error into a reusable status contract', () => {
    expect(buildCampaignComposerRouteStatus({
      error: 'Media service unavailable',
    })).toEqual({
      loadState: 'error',
      blockingReason: undefined,
      loadMessage: 'Media service unavailable',
      statusKind: 'error',
      statusTone: 'error',
      statusMessage: 'Campaign composer unavailable',
      statusDetail: 'Media service unavailable',
      ctaLayout: 'primary_only',
      primaryCta: {
        kind: 'back_to_campaigns',
        label: 'Back to campaigns',
        href: '/workspace/campanhas',
      },
      secondaryCta: undefined,
    });
  });

  test('buildCampaignComposerRouteActions maps a loaded composer page into reusable route actions', () => {
    expect(buildCampaignComposerRouteActions({
      page: {
        wizard: {} as any,
        summary: {
          availableVideoCount: 2,
          availableChannelCount: 3,
          activeChannelCount: 2,
        },
        actions: {
          cancelHref: '/workspace/campanhas',
          saveDraftLabel: 'Save draft',
        },
      },
    })).toEqual({
      cancelHref: '/workspace/campanhas',
      submitDraft: {
        kind: 'save_draft',
        label: 'Save draft',
        pendingLabel: 'Saving draft...',
        successRedirectPattern: '/workspace/campanhas/:campaignId',
        disabledState: undefined,
        disabledReason: undefined,
      },
    });
  });

  test('buildCampaignComposerRouteActions maps a blocked composer page into reusable route actions', () => {
    expect(buildCampaignComposerRouteActions({
      page: {
        wizard: {} as any,
        summary: {
          availableVideoCount: 1,
          availableChannelCount: 1,
          activeChannelCount: 0,
        },
        actions: {
          cancelHref: '/workspace/campanhas',
          saveDraftLabel: 'Save draft',
        },
        emptyState: {
          heading: 'No active channels available',
          body: 'Activate at least one YouTube channel before creating a campaign.',
          cta: 'Manage channels',
          ctaHref: '/workspace/accounts',
        },
      },
    })).toEqual({
      cancelHref: '/workspace/campanhas',
      submitDraft: {
        kind: 'save_draft',
        label: 'Save draft',
        pendingLabel: 'Saving draft...',
        successRedirectPattern: '/workspace/campanhas/:campaignId',
        disabledState: 'missing_active_channels',
        disabledReason: 'No active channels available',
      },
    });
  });

  test('buildCampaignComposerRouteActions maps missing page into reusable route actions', () => {
    expect(buildCampaignComposerRouteActions({})).toEqual({
      cancelHref: '/workspace/campanhas',
      submitDraft: undefined,
    });
  });

  test('buildCampaignComposerRouteErrorState maps a load error into a reusable route error contract', () => {
    expect(buildCampaignComposerRouteErrorState({
      error: 'Media service unavailable',
    })).toEqual({
      heading: 'Campaign composer unavailable',
      body: 'Media service unavailable',
      cta: 'Back to campaigns',
    });
  });

  test('buildCampaignComposerRouteErrorState falls back to a generic message when no error is provided', () => {
    expect(buildCampaignComposerRouteErrorState({})).toEqual({
      heading: 'Campaign composer unavailable',
      body: 'Campaign composer data is unavailable.',
      cta: 'Back to campaigns',
    });
  });

  test('buildCampaignComposerRouteView composes a ready route from a loaded page', () => {
    expect(buildCampaignComposerRouteView({
      page: {
        wizard: {} as any,
        summary: {
          availableVideoCount: 2,
          availableChannelCount: 3,
          activeChannelCount: 2,
        },
        actions: {
          cancelHref: '/workspace/campanhas',
          saveDraftLabel: 'Save draft',
        },
      },
    })).toEqual({
      route: '/workspace/campanhas/nova',
      backHref: '/workspace/campanhas',
      loadState: 'ready',
      blockingReason: undefined,
      loadMessage: 'Campaign composer is ready',
      statusKind: 'ready',
      statusTone: 'neutral',
      statusMessage: 'Campaign composer is ready',
      statusDetail: 'Videos and active channels are available.',
      ctaLayout: 'primary_secondary',
      primaryCta: {
        kind: 'save_draft',
        label: 'Save draft',
        pendingLabel: 'Saving draft...',
      },
      secondaryCta: {
        kind: 'cancel_composer',
        label: 'Cancel',
        href: '/workspace/campanhas',
      },
      actions: {
        cancelHref: '/workspace/campanhas',
        submitDraft: {
          kind: 'save_draft',
          label: 'Save draft',
          pendingLabel: 'Saving draft...',
          successRedirectPattern: '/workspace/campanhas/:campaignId',
          disabledState: undefined,
          disabledReason: undefined,
        },
      },
      page: {
        wizard: {} as any,
        summary: {
          availableVideoCount: 2,
          availableChannelCount: 3,
          activeChannelCount: 2,
        },
        actions: {
          cancelHref: '/workspace/campanhas',
          saveDraftLabel: 'Save draft',
        },
      },
    });
  });

  test('buildCampaignComposerRouteView composes an error route from a load error', () => {
    expect(buildCampaignComposerRouteView({
      error: 'Media service unavailable',
    })).toEqual({
      route: '/workspace/campanhas/nova',
      backHref: '/workspace/campanhas',
      loadState: 'error',
      blockingReason: undefined,
      loadMessage: 'Media service unavailable',
      statusKind: 'error',
      statusTone: 'error',
      statusMessage: 'Campaign composer unavailable',
      statusDetail: 'Media service unavailable',
      ctaLayout: 'primary_only',
      primaryCta: {
        kind: 'back_to_campaigns',
        label: 'Back to campaigns',
        href: '/workspace/campanhas',
      },
      secondaryCta: undefined,
      actions: {
        cancelHref: '/workspace/campanhas',
        submitDraft: undefined,
      },
      errorState: {
        heading: 'Campaign composer unavailable',
        body: 'Media service unavailable',
        cta: 'Back to campaigns',
      },
    });
  });

  test('submitCampaignComposerRouteDraft creates the campaign, bulk-adds targets, and redirects to detail', async () => {
    const fetcher = mockFetcher({
      'POST /api/campaigns': {
        status: 201,
        body: {
          campaign: {
            id: 'c-new',
            title: 'New Multi-Channel Campaign',
            status: 'draft',
          },
        },
      },
      'POST /api/campaigns/c-new/targets/bulk': {
        status: 201,
        body: {
          targets: [
            { id: 't-1', campaignId: 'c-new', channelId: 'ch-1' },
            { id: 't-2', campaignId: 'c-new', channelId: 'ch-2' },
          ],
        },
      },
    });

    const result = await submitCampaignComposerRouteDraft({
      fetcher,
      draft: {
        title: 'New Multi-Channel Campaign',
        videoAssetId: 'video-1',
        scheduledAt: '2026-05-10T10:00:00Z',
        selectedChannelIds: ['ch-1', 'ch-2'],
        targetTemplate: {
          videoTitle: 'Upload Title',
          videoDescription: 'Upload Description',
          tags: ['alpha'],
          publishAt: '2026-05-11T15:00:00Z',
          playlistId: 'playlist-1',
          privacy: 'unlisted',
          thumbnailAssetId: 'thumb-1',
        },
      },
    });

    expect(result).toEqual({
      ok: true,
      redirectHref: '/workspace/campanhas/c-new',
      campaign: {
        id: 'c-new',
        title: 'New Multi-Channel Campaign',
        status: 'draft',
      },
      targets: [
        { id: 't-1', campaignId: 'c-new', channelId: 'ch-1' },
        { id: 't-2', campaignId: 'c-new', channelId: 'ch-2' },
      ],
    });
  });

  test('submitCampaignComposerRouteDraft preserves create_campaign failure stage', async () => {
    const fetcher = mockFetcher({
      'POST /api/campaigns': {
        status: 400,
        body: {
          error: 'Missing required field: title',
        },
      },
    });

    const result = await submitCampaignComposerRouteDraft({
      fetcher,
      draft: {
        title: '',
        videoAssetId: 'video-1',
        selectedChannelIds: ['ch-1'],
        targetTemplate: {
          videoTitle: 'Upload Title',
          videoDescription: 'Upload Description',
        },
      },
    });

    expect(result).toEqual({
      ok: false,
      error: 'Missing required field: title',
      stage: 'create_campaign',
    });
  });

  test('submitCampaignComposerRouteDraft preserves add_targets failure stage', async () => {
    const fetcher = mockFetcher({
      'POST /api/campaigns': {
        status: 201,
        body: {
          campaign: {
            id: 'c-new',
            title: 'New Multi-Channel Campaign',
            status: 'draft',
          },
        },
      },
      'POST /api/campaigns/c-new/targets/bulk': {
        status: 400,
        body: {
          error: 'Duplicate channelId in targets payload: ch-1',
        },
      },
    });

    const result = await submitCampaignComposerRouteDraft({
      fetcher,
      draft: {
        title: 'New Multi-Channel Campaign',
        videoAssetId: 'video-1',
        selectedChannelIds: ['ch-1', 'ch-2'],
        targetTemplate: {
          videoTitle: 'Upload Title',
          videoDescription: 'Upload Description',
        },
      },
    });

    expect(result).toEqual({
      ok: false,
      error: 'Duplicate channelId in targets payload: ch-1',
      stage: 'add_targets',
    });
  });

  test('buildCampaignComposerSubmitErrorState maps create_campaign failures to a route-friendly message', () => {
    expect(buildCampaignComposerSubmitErrorState({
      ok: false,
      error: 'Missing required field: title',
      stage: 'create_campaign',
    })).toEqual({
      stage: 'create_campaign',
      nextStep: 'retry_submit',
      heading: 'Campaign draft could not be created',
      body: 'Missing required field: title',
      cta: 'Try again',
    });
  });

  test('buildCampaignComposerSubmitErrorState maps add_targets failures to a route-friendly message', () => {
    expect(buildCampaignComposerSubmitErrorState({
      ok: false,
      error: 'Duplicate channelId in targets payload: ch-1',
      stage: 'add_targets',
    })).toEqual({
      stage: 'add_targets',
      nextStep: 'review_channels',
      heading: 'Campaign targets could not be saved',
      body: 'Duplicate channelId in targets payload: ch-1',
      cta: 'Review channels',
    });
  });

  test('buildCampaignComposerSubmitSuccessState maps successful draft submission to a route-friendly redirect message', () => {
    expect(buildCampaignComposerSubmitSuccessState({
      ok: true,
      campaign: {
        id: 'c-new',
        title: 'New Multi-Channel Campaign',
        status: 'draft',
      },
      targets: [
        { id: 't-1', campaignId: 'c-new', channelId: 'ch-1' },
        { id: 't-2', campaignId: 'c-new', channelId: 'ch-2' },
      ] as any,
      redirectHref: '/workspace/campanhas/c-new',
    })).toEqual({
      nextStep: 'open_campaign',
      heading: 'Campaign draft saved',
      body: 'New Multi-Channel Campaign is ready for review and launch setup.',
      cta: 'Open campaign',
      href: '/workspace/campanhas/c-new',
    });
  });

  test('buildCampaignComposerSubmitStatus maps success into a reusable submit status contract', () => {
    expect(buildCampaignComposerSubmitStatus({
      ok: true,
      campaign: {
        id: 'c-new',
        title: 'New Multi-Channel Campaign',
        status: 'draft',
      },
      targets: [
        { id: 't-1', campaignId: 'c-new', channelId: 'ch-1' },
      ] as any,
      redirectHref: '/workspace/campanhas/c-new',
    })).toEqual({
      statusKind: 'success',
      statusTone: 'success',
      statusMessage: 'Campaign draft saved',
      statusDetail: 'New Multi-Channel Campaign is ready for review and launch setup.',
      nextStep: 'open_campaign',
      ctaLayout: 'primary_secondary',
      primaryCta: {
        kind: 'open_campaign',
        label: 'Open campaign',
        href: '/workspace/campanhas/c-new',
      },
      secondaryCta: {
        kind: 'back_to_campaigns',
        label: 'Back to campaigns',
        href: '/workspace/campanhas',
      },
    });
  });

  test('buildCampaignComposerSubmitStatus maps add_targets failure into a reusable submit status contract', () => {
    expect(buildCampaignComposerSubmitStatus({
      ok: false,
      error: 'Duplicate channelId in targets payload: ch-1',
      stage: 'add_targets',
    })).toEqual({
      statusKind: 'error',
      statusTone: 'error',
      statusMessage: 'Campaign targets could not be saved',
      statusDetail: 'Duplicate channelId in targets payload: ch-1',
      nextStep: 'review_channels',
      ctaLayout: 'primary_secondary',
      primaryCta: {
        kind: 'review_channels',
        label: 'Review channels',
      },
      secondaryCta: {
        kind: 'back_to_campaigns',
        label: 'Back to campaigns',
        href: '/workspace/campanhas',
      },
    });
  });

  test('buildCampaignComposerSubmitStatus maps create_campaign failure into a reusable submit status contract', () => {
    expect(buildCampaignComposerSubmitStatus({
      ok: false,
      error: 'Missing required field: title',
      stage: 'create_campaign',
    })).toEqual({
      statusKind: 'error',
      statusTone: 'error',
      statusMessage: 'Campaign draft could not be created',
      statusDetail: 'Missing required field: title',
      nextStep: 'retry_submit',
      ctaLayout: 'primary_secondary',
      primaryCta: {
        kind: 'retry_submit',
        label: 'Try again',
      },
      secondaryCta: {
        kind: 'back_to_campaigns',
        label: 'Back to campaigns',
        href: '/workspace/campanhas',
      },
    });
  });

  test('buildCampaignComposerSubmitView composes a success submit view from a successful result', () => {
    expect(buildCampaignComposerSubmitView({
      ok: true,
      campaign: {
        id: 'c-new',
        title: 'New Multi-Channel Campaign',
        status: 'draft',
      },
      targets: [
        { id: 't-1', campaignId: 'c-new', channelId: 'ch-1' },
      ] as any,
      redirectHref: '/workspace/campanhas/c-new',
    })).toEqual({
      ok: true,
      campaign: {
        id: 'c-new',
        title: 'New Multi-Channel Campaign',
        status: 'draft',
      },
      targets: [
        { id: 't-1', campaignId: 'c-new', channelId: 'ch-1' },
      ],
      redirectHref: '/workspace/campanhas/c-new',
      statusKind: 'success',
      statusTone: 'success',
      statusMessage: 'Campaign draft saved',
      statusDetail: 'New Multi-Channel Campaign is ready for review and launch setup.',
      nextStep: 'open_campaign',
      ctaLayout: 'primary_secondary',
      primaryCta: {
        kind: 'open_campaign',
        label: 'Open campaign',
        href: '/workspace/campanhas/c-new',
      },
      secondaryCta: {
        kind: 'back_to_campaigns',
        label: 'Back to campaigns',
        href: '/workspace/campanhas',
      },
      successState: {
        nextStep: 'open_campaign',
        heading: 'Campaign draft saved',
        body: 'New Multi-Channel Campaign is ready for review and launch setup.',
        cta: 'Open campaign',
        href: '/workspace/campanhas/c-new',
      },
    });
  });

  test('buildCampaignComposerSubmitView composes an error submit view from a failed result', () => {
    expect(buildCampaignComposerSubmitView({
      ok: false,
      error: 'Duplicate channelId in targets payload: ch-1',
      stage: 'add_targets',
    })).toEqual({
      ok: false,
      error: 'Duplicate channelId in targets payload: ch-1',
      stage: 'add_targets',
      statusKind: 'error',
      statusTone: 'error',
      statusMessage: 'Campaign targets could not be saved',
      statusDetail: 'Duplicate channelId in targets payload: ch-1',
      nextStep: 'review_channels',
      ctaLayout: 'primary_secondary',
      primaryCta: {
        kind: 'review_channels',
        label: 'Review channels',
      },
      secondaryCta: {
        kind: 'back_to_campaigns',
        label: 'Back to campaigns',
        href: '/workspace/campanhas',
      },
      errorState: {
        stage: 'add_targets',
        nextStep: 'review_channels',
        heading: 'Campaign targets could not be saved',
        body: 'Duplicate channelId in targets payload: ch-1',
        cta: 'Review channels',
      },
    });
  });

  test('buildCampaignComposerSubmitModel maps success into a single route-friendly submit contract', () => {
    expect(buildCampaignComposerSubmitModel({
      ok: true,
      campaign: {
        id: 'c-new',
        title: 'New Multi-Channel Campaign',
        status: 'draft',
      },
      targets: [
        { id: 't-1', campaignId: 'c-new', channelId: 'ch-1' },
      ] as any,
      redirectHref: '/workspace/campanhas/c-new',
    })).toEqual({
      ok: true,
      campaign: {
        id: 'c-new',
        title: 'New Multi-Channel Campaign',
        status: 'draft',
      },
      targets: [
        { id: 't-1', campaignId: 'c-new', channelId: 'ch-1' },
      ],
      redirectHref: '/workspace/campanhas/c-new',
      statusKind: 'success',
      statusTone: 'success',
      statusMessage: 'Campaign draft saved',
      statusDetail: 'New Multi-Channel Campaign is ready for review and launch setup.',
      nextStep: 'open_campaign',
      ctaLayout: 'primary_secondary',
      primaryCta: {
        kind: 'open_campaign',
        label: 'Open campaign',
        href: '/workspace/campanhas/c-new',
      },
      secondaryCta: {
        kind: 'back_to_campaigns',
        label: 'Back to campaigns',
        href: '/workspace/campanhas',
      },
      successState: {
        nextStep: 'open_campaign',
        heading: 'Campaign draft saved',
        body: 'New Multi-Channel Campaign is ready for review and launch setup.',
        cta: 'Open campaign',
        href: '/workspace/campanhas/c-new',
      },
    });
  });

  test('buildCampaignComposerSubmitModel maps add_targets error into a single route-friendly submit contract', () => {
    expect(buildCampaignComposerSubmitModel({
      ok: false,
      error: 'Duplicate channelId in targets payload: ch-1',
      stage: 'add_targets',
    })).toEqual({
      ok: false,
      error: 'Duplicate channelId in targets payload: ch-1',
      stage: 'add_targets',
      statusKind: 'error',
      statusTone: 'error',
      statusMessage: 'Campaign targets could not be saved',
      statusDetail: 'Duplicate channelId in targets payload: ch-1',
      nextStep: 'review_channels',
      ctaLayout: 'primary_secondary',
      primaryCta: {
        kind: 'review_channels',
        label: 'Review channels',
      },
      secondaryCta: {
        kind: 'back_to_campaigns',
        label: 'Back to campaigns',
        href: '/workspace/campanhas',
      },
      errorState: {
        stage: 'add_targets',
        nextStep: 'review_channels',
        heading: 'Campaign targets could not be saved',
        body: 'Duplicate channelId in targets payload: ch-1',
        cta: 'Review channels',
      },
    });
  });

  test('buildCampaignComposerSubmitModel maps create_campaign error into a retry-oriented submit contract', () => {
    expect(buildCampaignComposerSubmitModel({
      ok: false,
      error: 'Missing required field: title',
      stage: 'create_campaign',
    })).toEqual({
      ok: false,
      error: 'Missing required field: title',
      stage: 'create_campaign',
      statusKind: 'error',
      statusTone: 'error',
      statusMessage: 'Campaign draft could not be created',
      statusDetail: 'Missing required field: title',
      nextStep: 'retry_submit',
      ctaLayout: 'primary_secondary',
      primaryCta: {
        kind: 'retry_submit',
        label: 'Try again',
      },
      secondaryCta: {
        kind: 'back_to_campaigns',
        label: 'Back to campaigns',
        href: '/workspace/campanhas',
      },
      errorState: {
        stage: 'create_campaign',
        nextStep: 'retry_submit',
        heading: 'Campaign draft could not be created',
        body: 'Missing required field: title',
        cta: 'Try again',
      },
    });
  });

  test('buildCampaignsPage fetches campaign list with filters and preserves pagination metadata', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns?status=ready&search=launch&limit=10&offset=20': {
        status: 200,
        body: {
          campaigns: [
            {
              id: 'c4',
              title: 'Ready Campaign',
              videoAssetName: 'launch.mp4',
              targetCount: 2,
              status: 'ready',
              createdAt: '2026-04-04T00:00:00Z',
            },
          ],
          total: 31,
          limit: 10,
          offset: 20,
        },
      },
    });

    const view = await buildCampaignsPage({
      fetcher,
      filters: {
        status: 'ready',
        search: 'launch',
        limit: 10,
        offset: 20,
      },
    });

    expect(view.error).toBeUndefined();
    expect(view.page?.list.rows).toHaveLength(1);
    expect(view.page?.list.rows[0].title).toBe('Ready Campaign');
    expect(view.page?.appliedFilters).toEqual({
      status: 'ready',
      search: 'launch',
      hasFilters: true,
      clearFiltersHref: '/workspace/campanhas',
    });
    expect(view.page?.pagination).toEqual({
      total: 31,
      limit: 10,
      offset: 20,
      count: 1,
      hasPrevious: true,
      hasNext: true,
      previousOffset: 10,
      nextOffset: 30,
      previousHref: '/workspace/campanhas?status=ready&search=launch&limit=10&offset=10',
      nextHref: '/workspace/campanhas?status=ready&search=launch&limit=10&offset=30',
    });
  });

  test('buildCampaignsPage exposes the next scheduled ready campaign overview', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns': {
        status: 200,
        body: {
          campaigns: [
            {
              id: 'c1',
              title: 'Completed Campaign',
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
          total: 3,
          limit: 20,
          offset: 0,
        },
      },
    });

    const view = await buildCampaignsPage({ fetcher });

    expect(view.error).toBeUndefined();
    expect(view.page?.scheduleOverview).toEqual({
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
    expect(view.page?.scheduleBanner).toEqual({
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
    expect(view.page?.list.rows.find((row) => row.id === 'c1')?.schedulePosition).toBeUndefined();
    expect(view.page?.list.rows.find((row) => row.id === 'c2')?.schedulePosition).toBe(2);
    expect(view.page?.list.rows.find((row) => row.id === 'c3')?.schedulePosition).toBe(1);
  });

  test('maps per-target final outcomes into campaign list outcome summaries when targets are present', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns': {
        status: 200,
        body: {
          campaigns: [
            {
              id: 'c-history',
              title: 'History Campaign',
              videoAssetName: 'intro.mp4',
              targetCount: 3,
              status: 'completed',
              createdAt: '2026-04-01T00:00:00Z',
              targets: [
                {
                  id: 't1',
                  status: 'publicado',
                  youtubeVideoId: 'yt-1',
                  errorMessage: null,
                },
                {
                  id: 't2',
                  status: 'erro',
                  youtubeVideoId: null,
                  errorMessage: 'quotaExceeded',
                },
                {
                  id: 't3',
                  status: 'aguardando',
                  youtubeVideoId: null,
                  errorMessage: null,
                },
              ],
            },
          ],
          total: 1,
          limit: 20,
          offset: 0,
        },
      },
    });

    const view = await buildCampaignsPage({ fetcher });

    expect(view.error).toBeUndefined();
    expect(view.page?.list.rows[0].outcomeSummary).toEqual({
      publishedCount: 1,
      failedCount: 1,
      pendingCount: 1,
    });
    expect(view.page?.list.rows[0].outcomeState).toBe('mixed');
    expect(view.page?.list.rows[0].outcomeAction).toEqual({
      kind: 'review_mixed_campaign',
      href: '/workspace/campanhas/c-history',
    });
    expect(view.page?.list.rows[0].primaryAction).toEqual({
      kind: 'review_mixed_campaign',
      href: '/workspace/campanhas/c-history',
    });
  });

  test('buildCampaignsPage aggregates visible target outcomes into historyOverview', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns': {
        status: 200,
        body: {
          campaigns: [
            {
              id: 'c1',
              title: 'History Campaign 1',
              videoAssetName: 'intro.mp4',
              targetCount: 2,
              status: 'completed',
              createdAt: '2026-04-01T00:00:00Z',
              targets: [
                { id: 't1', status: 'publicado', youtubeVideoId: 'yt-1', errorMessage: null },
                { id: 't2', status: 'erro', youtubeVideoId: null, errorMessage: 'quotaExceeded' },
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
                { id: 't4', status: 'publicado', youtubeVideoId: 'yt-2', errorMessage: null },
                { id: 't5', status: 'aguardando', youtubeVideoId: null, errorMessage: null },
              ],
            },
          ],
          total: 2,
          limit: 20,
          offset: 0,
        },
      },
    });

    const view = await buildCampaignsPage({ fetcher });

    expect(view.error).toBeUndefined();
    expect(view.page?.historyOverview).toEqual({
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
    expect(view.page?.historyBanner).toEqual({
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

  test('buildCampaignsPage uses a pending-only outcome CTA when no visible campaign has failures', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns': {
        status: 200,
        body: {
          campaigns: [
            {
              id: 'c1',
              title: 'Pending Campaign 1',
              videoAssetName: 'intro.mp4',
              targetCount: 2,
              status: 'completed',
              createdAt: '2026-04-01T00:00:00Z',
              targets: [
                { id: 't1', status: 'publicado', youtubeVideoId: 'yt-1', errorMessage: null },
                { id: 't2', status: 'aguardando', youtubeVideoId: null, errorMessage: null },
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
                { id: 't3', status: 'aguardando', youtubeVideoId: null, errorMessage: null },
              ],
            },
          ],
          total: 2,
          limit: 20,
          offset: 0,
        },
      },
    });

    const view = await buildCampaignsPage({ fetcher });

    expect(view.error).toBeUndefined();
    expect(view.page?.historyOverview).toEqual({
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
    expect(view.page?.historyBanner).toEqual({
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

  test('buildCampaignsPage uses a failed-only outcome CTA when no visible campaign is pending', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns': {
        status: 200,
        body: {
          campaigns: [
            {
              id: 'c1',
              title: 'Failed Campaign 1',
              videoAssetName: 'intro.mp4',
              targetCount: 2,
              status: 'completed',
              createdAt: '2026-04-01T00:00:00Z',
              targets: [
                { id: 't1', status: 'publicado', youtubeVideoId: 'yt-1', errorMessage: null },
                { id: 't2', status: 'erro', youtubeVideoId: null, errorMessage: 'quotaExceeded' },
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
                { id: 't3', status: 'erro', youtubeVideoId: null, errorMessage: 'processingError' },
              ],
            },
          ],
          total: 2,
          limit: 20,
          offset: 0,
        },
      },
    });

    const view = await buildCampaignsPage({ fetcher });

    expect(view.error).toBeUndefined();
    expect(view.page?.historyOverview).toEqual({
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
    expect(view.page?.historyBanner).toEqual({
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

  test('buildCampaignsPage shows a healthy outcome summary when no visible campaign has failures or pending targets', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns': {
        status: 200,
        body: {
          campaigns: [
            {
              id: 'c1',
              title: 'Healthy Campaign 1',
              videoAssetName: 'intro.mp4',
              targetCount: 1,
              status: 'completed',
              createdAt: '2026-04-01T00:00:00Z',
              targets: [
                { id: 't1', status: 'publicado', youtubeVideoId: 'yt-1', errorMessage: null },
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
                { id: 't2', status: 'publicado', youtubeVideoId: 'yt-2', errorMessage: null },
                { id: 't3', status: 'publicado', youtubeVideoId: 'yt-3', errorMessage: null },
              ],
            },
          ],
          total: 2,
          limit: 20,
          offset: 0,
        },
      },
    });

    const view = await buildCampaignsPage({ fetcher });

    expect(view.error).toBeUndefined();
    expect(view.page?.historyOverview).toEqual({
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
    expect(view.page?.historyBanner).toEqual({
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

  test('buildCampaignsPage aggregates outcomeState distribution across visible campaigns', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns': {
        status: 200,
        body: {
          campaigns: [
            {
              id: 'failed',
              title: 'Failed Campaign',
              videoAssetName: 'failed.mp4',
              targetCount: 1,
              status: 'completed',
              createdAt: '2026-04-02T00:00:00Z',
              targets: [
                { id: 't4', status: 'erro', youtubeVideoId: null, errorMessage: 'processingError' },
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
                { id: 't1', status: 'publicado', youtubeVideoId: 'yt-1', errorMessage: null },
                { id: 't2', status: 'erro', youtubeVideoId: null, errorMessage: 'quotaExceeded' },
                { id: 't3', status: 'aguardando', youtubeVideoId: null, errorMessage: null },
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
                { id: 't5', status: 'aguardando', youtubeVideoId: null, errorMessage: null },
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
                { id: 't6', status: 'publicado', youtubeVideoId: 'yt-2', errorMessage: null },
              ],
            },
          ],
          total: 4,
          limit: 20,
          offset: 0,
        },
      },
    });

    const view = await buildCampaignsPage({ fetcher });

    expect(view.error).toBeUndefined();
    expect(view.page?.historyOverview?.outcomeStateCounts).toEqual({
      mixed: 1,
      failed: 1,
      pending: 1,
      healthy: 1,
    });
    expect(view.page?.historyOverview?.outcomeStateCampaignIds).toEqual({
      mixed: ['mixed'],
      failed: ['failed'],
      pending: ['pending'],
      healthy: ['healthy'],
    });
    expect(view.page?.historyBanner?.outcomeStateCampaignIds).toEqual({
      mixed: ['mixed'],
      failed: ['failed'],
      pending: ['pending'],
      healthy: ['healthy'],
    });
    expect(view.page?.historyOverview?.dominantOutcomeState).toBe('mixed');
    expect(view.page?.historyBanner?.kind).toBe('mixed');
    expect(view.page?.historyOverview?.primaryAction).toEqual({
      kind: 'review_mixed_campaign',
      href: '/workspace/campanhas/mixed',
    });
    expect(view.page?.historyOverview?.secondaryAction).toEqual({
      kind: 'review_failed_campaign',
      href: '/workspace/campanhas/failed',
    });
    expect(view.page?.historyBanner?.primaryAction).toEqual({
      kind: 'review_mixed_campaign',
      href: '/workspace/campanhas/mixed',
    });
    expect(view.page?.historyBanner?.secondaryAction).toEqual({
      kind: 'review_failed_campaign',
      href: '/workspace/campanhas/failed',
    });
  });

  test('buildCampaignsPage uses a mixed secondary outcome CTA when multiple mixed campaigns are visible', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns': {
        status: 200,
        body: {
          campaigns: [
            {
              id: 'mixed-1',
              title: 'Mixed Campaign 1',
              videoAssetName: 'mixed-1.mp4',
              targetCount: 3,
              status: 'completed',
              createdAt: '2026-04-01T00:00:00Z',
              targets: [
                { id: 't1', status: 'publicado', youtubeVideoId: 'yt-1', errorMessage: null },
                { id: 't2', status: 'erro', youtubeVideoId: null, errorMessage: 'quotaExceeded' },
                { id: 't3', status: 'aguardando', youtubeVideoId: null, errorMessage: null },
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
                { id: 't4', status: 'erro', youtubeVideoId: null, errorMessage: 'processingError' },
                { id: 't5', status: 'aguardando', youtubeVideoId: null, errorMessage: null },
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
                { id: 't6', status: 'publicado', youtubeVideoId: 'yt-2', errorMessage: null },
              ],
            },
          ],
          total: 3,
          limit: 20,
          offset: 0,
        },
      },
    });

    const view = await buildCampaignsPage({ fetcher });

    expect(view.error).toBeUndefined();
    expect(view.page?.historyOverview?.dominantOutcomeState).toBe('mixed');
    expect(view.page?.historyOverview?.primaryAction).toEqual({
      kind: 'review_mixed_campaign',
      href: '/workspace/campanhas/mixed-1',
    });
    expect(view.page?.historyOverview?.secondaryAction).toEqual({
      kind: 'review_mixed_campaign',
      href: '/workspace/campanhas/mixed-2',
    });
    expect(view.page?.historyBanner?.primaryAction).toEqual({
      kind: 'review_mixed_campaign',
      href: '/workspace/campanhas/mixed-1',
    });
    expect(view.page?.historyBanner?.secondaryAction).toEqual({
      kind: 'review_mixed_campaign',
      href: '/workspace/campanhas/mixed-2',
    });
  });

  test('buildCampaignsPage returns an error state when list fetch fails', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns': {
        status: 500,
        body: { error: 'Server error' },
      },
    });

    const view = await buildCampaignsPage({ fetcher });

    expect(view.page).toBeUndefined();
    expect(view.error).toBe('Server error');
    expect(view.errorState).toEqual({
      heading: 'Campaign list unavailable',
      body: 'Server error',
      cta: 'Retry',
      retryHref: '/workspace/campanhas',
    });
  });

  test('buildCampaignsPage exposes a filtered empty state when filters return no campaigns', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns?status=ready&search=launch': {
        status: 200,
        body: {
          campaigns: [],
          total: 0,
          limit: 20,
          offset: 0,
        },
      },
    });

    const view = await buildCampaignsPage({
      fetcher,
      filters: {
        status: 'ready',
        search: 'launch',
      },
    });

    expect(view.error).toBeUndefined();
    expect(view.page?.list.isEmpty).toBe(true);
    expect(view.page?.appliedFilters).toEqual({
      status: 'ready',
      search: 'launch',
      hasFilters: true,
      clearFiltersHref: '/workspace/campanhas',
    });
    expect(view.page?.emptyState).toEqual({
      heading: 'No campaigns match the current filters',
      body: 'Try clearing filters or adjusting your search.',
      cta: 'Clear filters',
      ctaHref: '/workspace/campanhas',
      clearFiltersHref: '/workspace/campanhas',
    });
  });

  test('buildCampaignsPage exposes a pagination empty state when the current page is past the available results', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns?status=ready&search=launch&limit=10&offset=40': {
        status: 200,
        body: {
          campaigns: [],
          total: 31,
          limit: 10,
          offset: 40,
        },
      },
    });

    const view = await buildCampaignsPage({
      fetcher,
      filters: {
        status: 'ready',
        search: 'launch',
        limit: 10,
        offset: 40,
      },
    });

    expect(view.error).toBeUndefined();
    expect(view.page?.pagination).toEqual({
      total: 31,
      limit: 10,
      offset: 40,
      count: 0,
      hasPrevious: true,
      hasNext: false,
      previousOffset: 30,
      nextOffset: undefined,
      previousHref: '/workspace/campanhas?status=ready&search=launch&limit=10&offset=30',
      nextHref: undefined,
    });
    expect(view.page?.emptyState).toEqual({
      heading: 'No campaigns on this page',
      body: 'Go back to the previous page or adjust your filters.',
      cta: 'Previous page',
      ctaHref: '/workspace/campanhas?status=ready&search=launch&limit=10&offset=30',
      clearFiltersHref: '/workspace/campanhas?status=ready&search=launch&limit=10&offset=30',
    });
  });

  test('buildCampaignDetailPage fetches campaign and live status and composes the detail page', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns/:id': {
        status: 200,
        body: {
          campaign: {
            id: 'c1',
            title: 'Campaign Detail',
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
        },
      },
      'GET /api/campaigns/:id/status': {
        status: 200,
        body: {
          campaignId: 'c1',
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
              errorMessage: 'Video uploaded as yt-partial-123, but applying the thumbnail failed: forbidden',
              latestJobStatus: 'failed',
              hasPostUploadWarning: true,
              reviewYoutubeUrl: 'https://www.youtube.com/watch?v=yt-partial-123',
            },
          ],
        },
      },
      'GET /api/campaigns/c1/jobs': {
        status: 200,
        body: {
          jobsByTarget: {
            t1: [
              {
                id: 'job-1',
                campaignTargetId: 't1',
                status: 'failed',
                attempt: 1,
                progressPercent: 100,
                youtubeVideoId: 'yt-partial-123',
                errorMessage: 'Video uploaded as yt-partial-123, but applying the thumbnail failed: forbidden',
                startedAt: '2026-04-01T00:01:00Z',
                completedAt: null,
                createdAt: '2026-04-01T00:00:00Z',
              },
            ],
          },
        },
      },
      'GET /api/campaigns/:id/audit': {
        status: 200,
        body: {
          events: [
            {
              id: 'audit-1',
              eventType: 'publish_partial_failure',
              actorEmail: 'system@internal',
              campaignId: 'c1',
              targetId: 't1',
              createdAt: '2026-04-01T00:03:30Z',
            },
            {
              id: 'audit-2',
              eventType: 'launch_campaign',
              actorEmail: 'ops@test.com',
              campaignId: 'c1',
              targetId: null,
              createdAt: '2026-04-01T00:00:30Z',
            },
          ],
        },
      },
    });

    const view = await buildCampaignDetailPage({ campaignId: 'c1', fetcher });

    expect(view.error).toBeUndefined();
    expect(view.page!.detail.header.status).toBe('failed');
    expect(view.page!.detail.targets[0].partialFailureYoutubeUrl).toBe('https://www.youtube.com/watch?v=yt-partial-123');
    expect(view.page!.polling.enabled).toBe(false);
    expect(view.page!.targetHistory).toEqual([
      {
        targetId: 't1',
        jobs: [
          {
            id: 'job-1',
            status: 'failed',
            attempt: 1,
            startedAt: '2026-04-01T00:01:00Z',
            completedAt: null,
            errorMessage: 'Video uploaded as yt-partial-123, but applying the thumbnail failed: forbidden',
            youtubeVideoId: 'yt-partial-123',
          },
        ],
      },
    ]);
    expect(view.page!.auditSummary).toEqual({
      totalEvents: 2,
      operatorEventCount: 1,
      systemEventCount: 1,
      lastEventType: 'publish_partial_failure',
      lastActorEmail: 'system@internal',
      lastCreatedAt: '2026-04-01T00:03:30Z',
    });
    expect(view.page!.auditTimeline).toEqual([
      {
        id: 'audit-1',
        eventType: 'publish_partial_failure',
        actorEmail: 'system@internal',
        targetId: 't1',
        createdAt: '2026-04-01T00:03:30Z',
      },
      {
        id: 'audit-2',
        eventType: 'launch_campaign',
        actorEmail: 'ops@test.com',
        targetId: null,
        createdAt: '2026-04-01T00:00:30Z',
      },
    ]);
    expect(view.page!.activitySummary).toEqual({
      totalEvents: 3,
      jobEvents: 1,
      auditEvents: 2,
      latestEventAt: '2026-04-01T00:03:30Z',
    });
    expect(view.page!.activityTimeline).toEqual([
      {
        kind: 'audit',
        timestamp: '2026-04-01T00:03:30Z',
        targetId: 't1',
        eventId: 'audit-1',
        eventType: 'publish_partial_failure',
        actorEmail: 'system@internal',
      },
      {
        kind: 'job',
        timestamp: '2026-04-01T00:01:00Z',
        targetId: 't1',
        jobId: 'job-1',
        jobStatus: 'failed',
        attempt: 1,
      },
      {
        kind: 'audit',
        timestamp: '2026-04-01T00:00:30Z',
        targetId: null,
        eventId: 'audit-2',
        eventType: 'launch_campaign',
        actorEmail: 'ops@test.com',
      },
    ]);
  });

  test('buildCampaignDetailPage returns an error state when the campaign fetch fails', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns/:id': {
        status: 404,
        body: { error: 'Campaign not found' },
      },
    });

    const view = await buildCampaignDetailPage({ campaignId: 'missing', fetcher });

    expect(view.page).toBeUndefined();
    expect(view.error).toBe('Campaign not found');
  });

  test('buildCampaignDetailPage returns an error state when the campaign request throws', async () => {
    const fetcher: AuthFetch = vi.fn(() => Promise.reject(new Error('Network down')));

    const view = await buildCampaignDetailPage({ campaignId: 'missing', fetcher });

    expect(view.page).toBeUndefined();
    expect(view.error).toBe('Network down');
  });

  test('buildCampaignDetailPage fetches aggregated campaign jobs without falling back to per-target job requests', async () => {
    const baseFetcher = mockFetcher({
      'GET /api/campaigns/:id': {
        status: 200,
        body: {
          campaign: {
            id: 'c1',
            title: 'Campaign Detail',
            videoAssetName: 'intro.mp4',
            status: 'launching',
            createdAt: '2026-04-01T00:00:00Z',
            targets: [
              {
                id: 't1',
                channelTitle: 'Main Channel',
                videoTitle: 'Upload 1',
                status: 'aguardando',
                youtubeVideoId: null,
                errorMessage: null,
              },
              {
                id: 't2',
                channelTitle: 'Second Channel',
                videoTitle: 'Upload 2',
                status: 'aguardando',
                youtubeVideoId: null,
                errorMessage: null,
              },
            ],
          },
        },
      },
      'GET /api/campaigns/:id/status': {
        status: 200,
        body: {
          campaignId: 'c1',
          campaignStatus: 'launching',
          shouldPoll: true,
          progress: { completed: 0, failed: 0, total: 2 },
          targets: [],
        },
      },
      'GET /api/campaigns/c1/jobs': {
        status: 200,
        body: {
          jobsByTarget: {
            t1: [],
            t2: [],
          },
        },
      },
    });
    const fetcher = vi.fn(baseFetcher);

    await buildCampaignDetailPage({ campaignId: 'c1', fetcher });

    const calledUrls = fetcher.mock.calls.map(([url]) => url);
    expect(calledUrls).toContain('/api/campaigns/c1/jobs');
    expect(calledUrls).not.toContain('/api/campaigns/c1/targets/t1/jobs');
    expect(calledUrls).not.toContain('/api/campaigns/c1/targets/t2/jobs');
  });

  test('buildCampaignDetailPage fetches status and campaign jobs in parallel after the campaign loads', async () => {
    const started: string[] = [];
    let resolveStatus: (() => void) | undefined;
    let resolveJobs: (() => void) | undefined;
    let resolveAudit: (() => void) | undefined;

    const fetcher: AuthFetch = vi.fn((url: string) => {
      if (url === '/api/campaigns/c1') {
        return Promise.resolve(createJsonResponse(200, {
          campaign: {
            id: 'c1',
            title: 'Parallel Detail',
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
        }));
      }

      if (url === '/api/campaigns/c1/status') {
        started.push('status');
        return new Promise<AuthFetchResponse>((resolve) => {
          resolveStatus = () => resolve(createJsonResponse(200, {
            campaignId: 'c1',
            campaignStatus: 'launching',
            shouldPoll: true,
            progress: { completed: 0, failed: 0, total: 1 },
            targets: [],
          }));
        });
      }

      if (url === '/api/campaigns/c1/jobs') {
        started.push('jobs');
        return new Promise<AuthFetchResponse>((resolve) => {
          resolveJobs = () => resolve(createJsonResponse(200, {
            jobsByTarget: { t1: [] },
          }));
        });
      }

      if (url === '/api/campaigns/c1/audit') {
        started.push('audit');
        return new Promise<AuthFetchResponse>((resolve) => {
          resolveAudit = () => resolve(createJsonResponse(200, {
            events: [],
          }));
        });
      }

      return Promise.resolve(createJsonResponse(404, { error: 'Not found' }));
    });

    const pending = buildCampaignDetailPage({ campaignId: 'c1', fetcher });

    await vi.waitFor(() => {
      expect(started).toEqual(['status', 'jobs', 'audit']);
    });

    resolveStatus?.();
    resolveJobs?.();
    resolveAudit?.();

    const view = await pending;
    expect(view.error).toBeUndefined();
    expect(view.page?.detail.header.title).toBe('Parallel Detail');
  });

  test('buildCampaignDetailPage skips campaign jobs fetch when the campaign has no targets', async () => {
    const fetcher: AuthFetch = vi.fn((url: string) => {
      if (url === '/api/campaigns/c-empty') {
        return Promise.resolve(createJsonResponse(200, {
          campaign: {
            id: 'c-empty',
            title: 'Empty Campaign',
            videoAssetName: 'intro.mp4',
            status: 'draft',
            createdAt: '2026-04-01T00:00:00Z',
            targets: [],
          },
        }));
      }

      if (url === '/api/campaigns/c-empty/status') {
        return Promise.resolve(createJsonResponse(200, {
          campaignId: 'c-empty',
          campaignStatus: 'draft',
          shouldPoll: false,
          progress: { completed: 0, failed: 0, total: 0 },
          targets: [],
        }));
      }

      if (url === '/api/campaigns/c-empty/audit') {
        return Promise.resolve(createJsonResponse(200, {
          events: [],
        }));
      }

      if (url === '/api/campaigns/c-empty/jobs') {
        return Promise.resolve(createJsonResponse(200, {
          jobsByTarget: {},
        }));
      }

      return Promise.resolve(createJsonResponse(404, { error: 'Not found' }));
    });

    const view = await buildCampaignDetailPage({ campaignId: 'c-empty', fetcher });

    expect(view.error).toBeUndefined();
    expect(view.page?.detail.header.title).toBe('Empty Campaign');

    const calledUrls = fetcher.mock.calls.map(([url]) => url);
    expect(calledUrls).toContain('/api/campaigns/c-empty');
    expect(calledUrls).toContain('/api/campaigns/c-empty/status');
    expect(calledUrls).toContain('/api/campaigns/c-empty/audit');
    expect(calledUrls).not.toContain('/api/campaigns/c-empty/jobs');
  });

  test('buildCampaignDetailPage still returns the base campaign when live status fetch throws', async () => {
    const fetcher: AuthFetch = vi.fn((url: string) => {
      if (url === '/api/campaigns/c-status-error') {
        return Promise.resolve(createJsonResponse(200, {
          campaign: {
            id: 'c-status-error',
            title: 'Campaign Without Status',
            videoAssetName: 'intro.mp4',
            status: 'draft',
            createdAt: '2026-04-01T00:00:00Z',
            targets: [],
          },
        }));
      }

      if (url === '/api/campaigns/c-status-error/status') {
        return Promise.reject(new Error('status fetch failed'));
      }

      return Promise.resolve(createJsonResponse(404, { error: 'Not found' }));
    });

    const view = await buildCampaignDetailPage({ campaignId: 'c-status-error', fetcher });

    expect(view.error).toBeUndefined();
    expect(view.page?.detail.header).toEqual({
      title: 'Campaign Without Status',
      videoAssetName: 'intro.mp4',
      status: 'draft',
    });
    expect(view.page?.detail.targets).toEqual([]);
    expect(view.page?.detail.progress).toEqual({
      completed: 0,
      total: 0,
    });
    expect(view.page?.polling).toEqual({
      enabled: false,
      intervalMs: 3000,
      nextScheduledAt: null,
    });
  });

  test('buildCampaignDetailPage still returns live status when campaign jobs fetch throws', async () => {
    const fetcher: AuthFetch = vi.fn((url: string) => {
      if (url === '/api/campaigns/c-jobs-error') {
        return Promise.resolve(createJsonResponse(200, {
          campaign: {
            id: 'c-jobs-error',
            title: 'Campaign Without Jobs',
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
        }));
      }

      if (url === '/api/campaigns/c-jobs-error/status') {
        return Promise.resolve(createJsonResponse(200, {
          campaignId: 'c-jobs-error',
          campaignStatus: 'launching',
          shouldPoll: true,
          progress: { completed: 0, failed: 0, total: 1 },
          targets: [
            {
              targetId: 't1',
              channelId: 'ch-1',
              videoTitle: 'Upload',
              status: 'enviando',
              youtubeVideoId: null,
              errorMessage: null,
              latestJobStatus: 'processing',
              hasPostUploadWarning: false,
              reviewYoutubeUrl: null,
            },
          ],
        }));
      }

      if (url === '/api/campaigns/c-jobs-error/jobs') {
        return Promise.reject(new Error('jobs fetch failed'));
      }

      return Promise.resolve(createJsonResponse(404, { error: 'Not found' }));
    });

    const view = await buildCampaignDetailPage({ campaignId: 'c-jobs-error', fetcher });

    expect(view.error).toBeUndefined();
    expect(view.page?.detail.header.status).toBe('launching');
    expect(view.page?.detail.targets).toEqual([
      expect.objectContaining({
        id: 't1',
        channelTitle: 'Main Channel',
        videoTitle: 'Upload',
        status: 'enviando',
        youtubeVideoId: null,
        errorMessage: null,
        retryAvailable: false,
        hasPostUploadWarning: false,
        reviewYoutubeUrl: null,
      }),
    ]);
    expect(view.page?.polling).toEqual({
      enabled: true,
      intervalMs: 3000,
      nextScheduledAt: null,
    });
    expect(view.page?.targetHistory).toBeUndefined();
  });

  test('buildCampaignDetailRoute exposes route metadata and loaded page data', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns/:id': {
        status: 200,
        body: {
          campaign: {
            id: 'c1',
            title: 'Campaign Detail',
            videoAssetName: 'intro.mp4',
            status: 'launching',
            createdAt: '2026-04-01T00:00:00Z',
            targets: [
              {
                id: 't1',
                channelTitle: 'Main Channel',
                videoTitle: 'Upload',
                status: 'erro',
                youtubeVideoId: null,
                errorMessage: 'quotaExceeded',
                retryCount: 1,
                maxRetries: 3,
              },
              {
                id: 't2',
                channelTitle: 'Second Channel',
                videoTitle: 'Published',
                status: 'erro',
                youtubeVideoId: 'yt-partial-123',
                errorMessage: 'Video uploaded as yt-partial-123, but applying the thumbnail failed: forbidden',
              },
            ],
          },
        },
      },
      'GET /api/campaigns/:id/status': {
        status: 200,
        body: {
          campaignId: 'c1',
          campaignStatus: 'launching',
          shouldPoll: true,
          progress: { completed: 0, failed: 2, total: 2 },
          targets: [
            {
              targetId: 't1',
              channelId: 'ch-1',
              videoTitle: 'Upload',
              status: 'erro',
              youtubeVideoId: null,
              errorMessage: 'quotaExceeded',
              latestJobStatus: 'failed',
              hasPostUploadWarning: false,
              reviewYoutubeUrl: null,
            },
            {
              targetId: 't2',
              channelId: 'ch-2',
              videoTitle: 'Published',
              status: 'erro',
              youtubeVideoId: 'yt-partial-123',
              errorMessage: 'Video uploaded as yt-partial-123, but applying the thumbnail failed: forbidden',
              latestJobStatus: 'failed',
              hasPostUploadWarning: true,
              reviewYoutubeUrl: 'https://www.youtube.com/watch?v=yt-partial-123',
            },
          ],
        },
      },
      'GET /api/campaigns/c1/jobs': {
        status: 200,
        body: {
          jobsByTarget: {
            t1: [
              {
                id: 'job-1',
                campaignTargetId: 't1',
                status: 'failed',
                attempt: 1,
                progressPercent: 100,
                youtubeVideoId: null,
                errorMessage: 'quotaExceeded',
                startedAt: '2026-04-01T00:01:00Z',
                completedAt: null,
                createdAt: '2026-04-01T00:00:00Z',
              },
            ],
            t2: [
              {
                id: 'job-2',
                campaignTargetId: 't2',
                status: 'completed',
                attempt: 1,
                progressPercent: 100,
                youtubeVideoId: 'yt-partial-123',
                errorMessage: null,
                startedAt: '2026-04-01T00:02:00Z',
                completedAt: '2026-04-01T00:03:00Z',
                createdAt: '2026-04-01T00:01:30Z',
              },
            ],
          },
        },
      },
      'GET /api/campaigns/:id/audit': {
        status: 200,
        body: {
          events: [
            {
              id: 'audit-1',
              eventType: 'publish_partial_failure',
              actorEmail: 'system@internal',
              campaignId: 'c1',
              targetId: 't2',
              createdAt: '2026-04-01T00:03:30Z',
            },
            {
              id: 'audit-2',
              eventType: 'retry_target',
              actorEmail: 'ops@test.com',
              campaignId: 'c1',
              targetId: 't1',
              createdAt: '2026-04-01T00:03:00Z',
            },
            {
              id: 'audit-3',
              eventType: 'launch_campaign',
              actorEmail: 'ops@test.com',
              campaignId: 'c1',
              targetId: null,
              createdAt: '2026-04-01T00:00:30Z',
            },
          ],
        },
      },
    });

    const view = await buildCampaignDetailRoute({
      params: { campaignId: 'c1' },
      fetcher,
    });

    expect(view.route).toBe('/workspace/campanhas/c1');
    expect(view.backHref).toBe('/workspace/campanhas');
    expect(view.page!.detail.header.title).toBe('Campaign Detail');
    expect(view.actions).toEqual({
      refreshHref: '/api/campaigns/c1/status',
      markReadyHref: undefined,
      launchHref: undefined,
      cloneHref: '/api/campaigns/c1/clone',
    });
    expect(view.summary).toEqual({
      totalTargets: 2,
      retryAvailableCount: 1,
      postUploadWarningCount: 1,
      targetsWithHistoryCount: 2,
      manualAttentionCount: 0,
      inProgressCount: 0,
    });
    expect(view.targetActions).toEqual([
      {
        targetId: 't1',
        historyHref: '/api/campaigns/c1/targets/t1/jobs',
        retryHref: '/api/campaigns/c1/targets/t1/retry',
        reviewHref: undefined,
      },
      {
        targetId: 't2',
        historyHref: '/api/campaigns/c1/targets/t2/jobs',
        retryHref: undefined,
        reviewHref: 'https://www.youtube.com/watch?v=yt-partial-123',
      },
    ]);
    expect(view.targetHistorySummary).toEqual([
      {
        targetId: 't1',
        latestJobId: 'job-1',
        latestJobStatus: 'failed',
        latestAttempt: 1,
        latestStartedAt: '2026-04-01T00:01:00Z',
        latestCompletedAt: null,
      },
      {
        targetId: 't2',
        latestJobId: 'job-2',
        latestJobStatus: 'completed',
        latestAttempt: 1,
        latestStartedAt: '2026-04-01T00:02:00Z',
        latestCompletedAt: '2026-04-01T00:03:00Z',
      },
    ]);
    expect(view.latestExecutionSummary).toEqual({
      targetId: 't2',
      latestJobId: 'job-2',
      latestJobStatus: 'completed',
      latestAttempt: 1,
      latestStartedAt: '2026-04-01T00:02:00Z',
      latestCompletedAt: '2026-04-01T00:03:00Z',
    });
    expect(view.latestFailedExecutionSummary).toEqual({
      targetId: 't1',
      latestJobId: 'job-1',
      latestJobStatus: 'failed',
      latestAttempt: 1,
      latestStartedAt: '2026-04-01T00:01:00Z',
      latestCompletedAt: null,
      errorMessage: 'quotaExceeded',
    });
    expect(view.latestSuccessfulExecutionSummary).toEqual({
      targetId: 't2',
      latestJobId: 'job-2',
      latestJobStatus: 'completed',
      latestAttempt: 1,
      latestStartedAt: '2026-04-01T00:02:00Z',
      latestCompletedAt: '2026-04-01T00:03:00Z',
      youtubeVideoId: 'yt-partial-123',
    });
    expect(view.auditSummary).toEqual({
      totalEvents: 3,
      operatorEventCount: 2,
      systemEventCount: 1,
      lastEventType: 'publish_partial_failure',
      lastActorEmail: 'system@internal',
      lastCreatedAt: '2026-04-01T00:03:30Z',
    });
    expect(view.auditTimeline).toEqual([
      {
        id: 'audit-1',
        eventType: 'publish_partial_failure',
        actorEmail: 'system@internal',
        targetId: 't2',
        createdAt: '2026-04-01T00:03:30Z',
        targetHistoryHref: '/api/campaigns/c1/targets/t2/jobs',
      },
      {
        id: 'audit-2',
        eventType: 'retry_target',
        actorEmail: 'ops@test.com',
        targetId: 't1',
        createdAt: '2026-04-01T00:03:00Z',
        targetHistoryHref: '/api/campaigns/c1/targets/t1/jobs',
      },
      {
        id: 'audit-3',
        eventType: 'launch_campaign',
        actorEmail: 'ops@test.com',
        targetId: null,
        createdAt: '2026-04-01T00:00:30Z',
        targetHistoryHref: undefined,
      },
    ]);
    expect(view.activitySummary).toEqual({
      totalEvents: 5,
      jobEvents: 2,
      auditEvents: 3,
      latestEventAt: '2026-04-01T00:03:30Z',
    });
    expect(view.activityTimeline).toEqual([
      {
        kind: 'audit',
        timestamp: '2026-04-01T00:03:30Z',
        targetId: 't2',
        eventId: 'audit-1',
        eventType: 'publish_partial_failure',
        actorEmail: 'system@internal',
        targetHistoryHref: '/api/campaigns/c1/targets/t2/jobs',
      },
      {
        kind: 'audit',
        timestamp: '2026-04-01T00:03:00Z',
        targetId: 't1',
        eventId: 'audit-2',
        eventType: 'retry_target',
        actorEmail: 'ops@test.com',
        targetHistoryHref: '/api/campaigns/c1/targets/t1/jobs',
      },
      {
        kind: 'job',
        timestamp: '2026-04-01T00:03:00Z',
        targetId: 't2',
        jobId: 'job-2',
        jobStatus: 'completed',
        attempt: 1,
        targetHistoryHref: '/api/campaigns/c1/targets/t2/jobs',
      },
      {
        kind: 'job',
        timestamp: '2026-04-01T00:01:00Z',
        targetId: 't1',
        jobId: 'job-1',
        jobStatus: 'failed',
        attempt: 1,
        targetHistoryHref: '/api/campaigns/c1/targets/t1/jobs',
      },
      {
        kind: 'audit',
        timestamp: '2026-04-01T00:00:30Z',
        targetId: null,
        eventId: 'audit-3',
        eventType: 'launch_campaign',
        actorEmail: 'ops@test.com',
        targetHistoryHref: undefined,
      },
    ]);
    expect(view.activityFilters).toEqual({
      selected: {
        key: 'all',
        kind: 'all',
        label: 'All activity',
        count: 5,
        href: '/workspace/campanhas/c1',
        active: true,
      },
      options: [
        {
          key: 'all',
          kind: 'all',
          label: 'All activity',
          count: 5,
          href: '/workspace/campanhas/c1',
          active: true,
        },
        {
          key: 'jobs',
          kind: 'jobs',
          label: 'Jobs',
          count: 2,
          href: '/workspace/campanhas/c1?activity=jobs',
          active: false,
        },
        {
          key: 'audit',
          kind: 'audit',
          label: 'Audit',
          count: 3,
          href: '/workspace/campanhas/c1?activity=audit',
          active: false,
        },
        {
          key: 'target:t2',
          kind: 'target',
          label: 'Target t2',
          count: 2,
          href: '/workspace/campanhas/c1?targetId=t2',
          active: false,
          targetId: 't2',
        },
        {
          key: 'target:t1',
          kind: 'target',
          label: 'Target t1',
          count: 2,
          href: '/workspace/campanhas/c1?targetId=t1',
          active: false,
          targetId: 't1',
        },
      ],
      filteredSummary: {
        totalEvents: 5,
        jobEvents: 2,
        auditEvents: 3,
        latestEventAt: '2026-04-01T00:03:30Z',
      },
      filteredTimeline: [
        {
          kind: 'audit',
          timestamp: '2026-04-01T00:03:30Z',
          targetId: 't2',
          eventId: 'audit-1',
          eventType: 'publish_partial_failure',
          actorEmail: 'system@internal',
          targetHistoryHref: '/api/campaigns/c1/targets/t2/jobs',
        },
        {
          kind: 'audit',
          timestamp: '2026-04-01T00:03:00Z',
          targetId: 't1',
          eventId: 'audit-2',
          eventType: 'retry_target',
          actorEmail: 'ops@test.com',
          targetHistoryHref: '/api/campaigns/c1/targets/t1/jobs',
        },
        {
          kind: 'job',
          timestamp: '2026-04-01T00:03:00Z',
          targetId: 't2',
          jobId: 'job-2',
          jobStatus: 'completed',
          attempt: 1,
          targetHistoryHref: '/api/campaigns/c1/targets/t2/jobs',
        },
        {
          kind: 'job',
          timestamp: '2026-04-01T00:01:00Z',
          targetId: 't1',
          jobId: 'job-1',
          jobStatus: 'failed',
          attempt: 1,
          targetHistoryHref: '/api/campaigns/c1/targets/t1/jobs',
        },
        {
          kind: 'audit',
          timestamp: '2026-04-01T00:00:30Z',
          targetId: null,
          eventId: 'audit-3',
          eventType: 'launch_campaign',
          actorEmail: 'ops@test.com',
          targetHistoryHref: undefined,
        },
      ],
    });

    const jobsFilteredView = await buildCampaignDetailRoute({
      params: { campaignId: 'c1' },
      fetcher,
      searchParams: { activity: 'jobs' },
    });
    expect(jobsFilteredView.activityFilters?.selected).toEqual({
      key: 'jobs',
      kind: 'jobs',
      label: 'Jobs',
      count: 2,
      href: '/workspace/campanhas/c1?activity=jobs',
      active: true,
    });
    expect(jobsFilteredView.activityFilters?.filteredSummary).toEqual({
      totalEvents: 2,
      jobEvents: 2,
      auditEvents: 0,
      latestEventAt: '2026-04-01T00:03:00Z',
    });
    expect(jobsFilteredView.activityFilters?.filteredTimeline.map((entry) => entry.kind)).toEqual([
      'job',
      'job',
    ]);

    const auditFilteredView = await buildCampaignDetailRoute({
      params: { campaignId: 'c1' },
      fetcher,
      searchParams: { activity: 'audit' },
    });
    expect(auditFilteredView.activityFilters?.selected).toEqual({
      key: 'audit',
      kind: 'audit',
      label: 'Audit',
      count: 3,
      href: '/workspace/campanhas/c1?activity=audit',
      active: true,
    });
    expect(auditFilteredView.activityFilters?.filteredSummary).toEqual({
      totalEvents: 3,
      jobEvents: 0,
      auditEvents: 3,
      latestEventAt: '2026-04-01T00:03:30Z',
    });
    expect(auditFilteredView.activityFilters?.filteredTimeline.map((entry) => entry.kind)).toEqual([
      'audit',
      'audit',
      'audit',
    ]);

    const targetFilteredView = await buildCampaignDetailRoute({
      params: { campaignId: 'c1' },
      fetcher,
      searchParams: { targetId: 't2' },
    });
    expect(targetFilteredView.activityFilters?.selected).toEqual({
      key: 'target:t2',
      kind: 'target',
      label: 'Target t2',
      count: 2,
      href: '/workspace/campanhas/c1?targetId=t2',
      active: true,
      targetId: 't2',
    });
    expect(targetFilteredView.activityFilters?.filteredSummary).toEqual({
      totalEvents: 2,
      jobEvents: 1,
      auditEvents: 1,
      latestEventAt: '2026-04-01T00:03:30Z',
    });
    expect(targetFilteredView.activityFilters?.filteredTimeline.map((entry) => entry.targetId)).toEqual([
      't2',
      't2',
    ]);
    expect(view.operationalOverview).toEqual({
      lifecycleState: 'launching',
      latestExecution: {
        targetId: 't2',
        latestJobId: 'job-2',
        latestJobStatus: 'completed',
        latestAttempt: 1,
        latestStartedAt: '2026-04-01T00:02:00Z',
        latestCompletedAt: '2026-04-01T00:03:00Z',
      },
      latestFailure: {
        targetId: 't1',
        latestJobId: 'job-1',
        latestJobStatus: 'failed',
        latestAttempt: 1,
        latestStartedAt: '2026-04-01T00:01:00Z',
        latestCompletedAt: null,
        errorMessage: 'quotaExceeded',
      },
      latestSuccess: {
        targetId: 't2',
        latestJobId: 'job-2',
        latestJobStatus: 'completed',
        latestAttempt: 1,
        latestStartedAt: '2026-04-01T00:02:00Z',
        latestCompletedAt: '2026-04-01T00:03:00Z',
        youtubeVideoId: 'yt-partial-123',
      },
      primaryAction: {
        kind: 'review_partial_failure',
        targetId: 't2',
        href: 'https://www.youtube.com/watch?v=yt-partial-123',
      },
      secondaryAction: {
        kind: 'retry_failed_target',
        targetId: 't1',
        href: '/api/campaigns/c1/targets/t1/retry',
      },
      dominantAttentionReason: 'review_required',
      attentionCounts: {
        review_required: 1,
        retry_available: 1,
        manual_attention: 0,
        in_progress: 0,
      },
      attentionTargets: {
        review_required: ['t2'],
        retry_available: ['t1'],
        manual_attention: [],
        in_progress: [],
      },
      attentionState: 'needs_review',
    });
    expect(view.statusBanner).toEqual({
      kind: 'needs_review',
      tone: 'warning',
      title: 'Campaign needs review',
      body: '1 target needs review before retry actions.',
      targetCount: 1,
      targetIds: ['t2'],
      primaryAction: {
        kind: 'review_partial_failure',
        targetId: 't2',
        href: 'https://www.youtube.com/watch?v=yt-partial-123',
      },
      secondaryAction: {
        kind: 'retry_failed_target',
        targetId: 't1',
        href: '/api/campaigns/c1/targets/t1/retry',
      },
    });
    expect(view.lastFailureSummary).toEqual([
      {
        targetId: 't1',
        latestAttempt: 1,
        errorMessage: 'quotaExceeded',
      },
      {
        targetId: 't2',
        latestAttempt: undefined,
        errorMessage: 'Video uploaded as yt-partial-123, but applying the thumbnail failed: forbidden',
      },
    ]);
    expect(view.priorityTargets).toEqual([
      {
        targetId: 't2',
        reason: 'review_required',
      },
      {
        targetId: 't1',
        reason: 'retry_available',
      },
    ]);
    expect(view.recommendedActions).toEqual([
      {
        kind: 'review_partial_failure',
        targetId: 't2',
        href: 'https://www.youtube.com/watch?v=yt-partial-123',
      },
      {
        kind: 'retry_failed_target',
        targetId: 't1',
        href: '/api/campaigns/c1/targets/t1/retry',
      },
    ]);
    expect(view.errorState).toBeUndefined();
  });

  test('buildCampaignDetailRoute exposes a friendly error state when loading fails', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns/:id': {
        status: 404,
        body: { error: 'Campaign not found' },
      },
    });

    const view = await buildCampaignDetailRoute({
      params: { campaignId: 'missing' },
      fetcher,
    });

    expect(view.page).toBeUndefined();
    expect(view.errorState).toEqual({
      heading: 'Campaign unavailable',
      body: 'Campaign not found',
      cta: 'Back to campaigns',
    });
  });

  test('buildCampaignDetailRoute omits retry wording in the banner when only review targets need attention', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns/:id': {
        status: 200,
        body: {
          campaign: {
            id: 'c2',
            title: 'Review Only Campaign',
            videoAssetName: 'intro.mp4',
            status: 'failed',
            createdAt: '2026-04-01T00:00:00Z',
            targets: [
              {
                id: 't-review',
                channelTitle: 'Main Channel',
                videoTitle: 'Published',
                status: 'erro',
                youtubeVideoId: 'yt-partial-999',
                errorMessage: 'Video uploaded as yt-partial-999, but adding it to playlist failed: forbidden',
                retryCount: 1,
                maxRetries: 3,
              },
            ],
          },
        },
      },
      'GET /api/campaigns/:id/status': {
        status: 200,
        body: {
          campaignId: 'c2',
          campaignStatus: 'failed',
          shouldPoll: false,
          progress: { completed: 0, failed: 1, total: 1 },
          targets: [
            {
              targetId: 't-review',
              channelId: 'ch-review',
              videoTitle: 'Published',
              status: 'erro',
              youtubeVideoId: 'yt-partial-999',
              errorMessage: 'Video uploaded as yt-partial-999, but adding it to playlist failed: forbidden',
              latestJobStatus: 'failed',
              hasPostUploadWarning: true,
              reviewYoutubeUrl: 'https://www.youtube.com/watch?v=yt-partial-999',
            },
          ],
        },
      },
      'GET /api/campaigns/c2/jobs': {
        status: 200,
        body: {
          jobsByTarget: {
            't-review': [
              {
                id: 'job-review-1',
                campaignTargetId: 't-review',
                status: 'failed',
                attempt: 1,
                progressPercent: 100,
                youtubeVideoId: 'yt-partial-999',
                errorMessage: 'Video uploaded as yt-partial-999, but adding it to playlist failed: forbidden',
                startedAt: '2026-04-01T00:01:00Z',
                completedAt: null,
                createdAt: '2026-04-01T00:00:00Z',
              },
            ],
          },
        },
      },
    });

    const view = await buildCampaignDetailRoute({
      params: { campaignId: 'c2' },
      fetcher,
    });

    expect(view.operationalOverview?.attentionCounts).toEqual({
      review_required: 1,
      retry_available: 0,
      manual_attention: 0,
      in_progress: 0,
    });
    expect(view.statusBanner).toEqual({
      kind: 'needs_review',
      tone: 'warning',
      title: 'Campaign needs review',
      body: '1 target needs review.',
      targetCount: 1,
      targetIds: ['t-review'],
      primaryAction: {
        kind: 'review_partial_failure',
        targetId: 't-review',
        href: 'https://www.youtube.com/watch?v=yt-partial-999',
      },
      secondaryAction: undefined,
    });
  });

  test('buildCampaignDetailRoute shows a retry banner when only retryable targets need attention', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns/:id': {
        status: 200,
        body: {
          campaign: {
            id: 'c3',
            title: 'Retry Only Campaign',
            videoAssetName: 'intro.mp4',
            status: 'failed',
            createdAt: '2026-04-01T00:00:00Z',
            targets: [
              {
                id: 't-retry',
                channelTitle: 'Main Channel',
                videoTitle: 'Upload',
                status: 'erro',
                youtubeVideoId: null,
                errorMessage: 'quotaExceeded',
                retryCount: 1,
                maxRetries: 3,
              },
            ],
          },
        },
      },
      'GET /api/campaigns/:id/status': {
        status: 200,
        body: {
          campaignId: 'c3',
          campaignStatus: 'failed',
          shouldPoll: false,
          progress: { completed: 0, failed: 1, total: 1 },
          targets: [
            {
              targetId: 't-retry',
              channelId: 'ch-retry',
              videoTitle: 'Upload',
              status: 'erro',
              youtubeVideoId: null,
              errorMessage: 'quotaExceeded',
              latestJobStatus: 'failed',
              hasPostUploadWarning: false,
              reviewYoutubeUrl: null,
            },
          ],
        },
      },
      'GET /api/campaigns/c3/jobs': {
        status: 200,
        body: {
          jobsByTarget: {
            't-retry': [
              {
                id: 'job-retry-1',
                campaignTargetId: 't-retry',
                status: 'failed',
                attempt: 1,
                progressPercent: 100,
                youtubeVideoId: null,
                errorMessage: 'quotaExceeded',
                startedAt: '2026-04-01T00:01:00Z',
                completedAt: null,
                createdAt: '2026-04-01T00:00:00Z',
              },
            ],
          },
        },
      },
    });

    const view = await buildCampaignDetailRoute({
      params: { campaignId: 'c3' },
      fetcher,
    });

    expect(view.operationalOverview?.attentionState).toBe('retry_available');
    expect(view.operationalOverview?.lifecycleState).toBe('failed');
    expect(view.statusBanner).toEqual({
      kind: 'retry_available',
      tone: 'neutral',
      title: 'Campaign has retryable targets',
      body: '1 target can be retried now.',
      targetCount: 1,
      targetIds: ['t-retry'],
      primaryAction: {
        kind: 'retry_failed_target',
        targetId: 't-retry',
        href: '/api/campaigns/c3/targets/t-retry/retry',
      },
      secondaryAction: undefined,
    });
  });

  test('buildCampaignDetailRoute shows a stable banner when no targets need review or retry', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns/:id': {
        status: 200,
        body: {
          campaign: {
            id: 'c4',
            title: 'Stable Campaign',
            videoAssetName: 'intro.mp4',
            status: 'completed',
            createdAt: '2026-04-01T00:00:00Z',
            targets: [
              {
                id: 't-stable',
                channelTitle: 'Main Channel',
                videoTitle: 'Published',
                status: 'publicado',
                youtubeVideoId: 'yt-stable-1',
                errorMessage: null,
              },
            ],
          },
        },
      },
      'GET /api/campaigns/:id/status': {
        status: 200,
        body: {
          campaignId: 'c4',
          campaignStatus: 'completed',
          shouldPoll: false,
          progress: { completed: 1, failed: 0, total: 1 },
          targets: [
            {
              targetId: 't-stable',
              channelId: 'ch-stable',
              videoTitle: 'Published',
              status: 'publicado',
              youtubeVideoId: 'yt-stable-1',
              errorMessage: null,
              latestJobStatus: 'completed',
              hasPostUploadWarning: false,
              reviewYoutubeUrl: null,
            },
          ],
        },
      },
      'GET /api/campaigns/c4/jobs': {
        status: 200,
        body: {
          jobsByTarget: {
            't-stable': [
              {
                id: 'job-stable-1',
                campaignTargetId: 't-stable',
                status: 'completed',
                attempt: 1,
                progressPercent: 100,
                youtubeVideoId: 'yt-stable-1',
                errorMessage: null,
                startedAt: '2026-04-01T00:01:00Z',
                completedAt: '2026-04-01T00:03:00Z',
                createdAt: '2026-04-01T00:00:00Z',
              },
            ],
          },
        },
      },
    });

    const view = await buildCampaignDetailRoute({
      params: { campaignId: 'c4' },
      fetcher,
    });

    expect(view.operationalOverview?.attentionState).toBe('stable');
    expect(view.operationalOverview?.lifecycleState).toBe('completed');
    expect(view.operationalOverview?.primaryAction).toEqual({
      kind: 'clone_campaign',
      href: '/api/campaigns/c4/clone',
    });
    expect(view.statusBanner).toEqual({
      kind: 'stable',
      tone: 'success',
      title: 'Campaign is stable',
      body: 'No targets currently require review or retry.',
      targetCount: 0,
      targetIds: [],
      primaryAction: {
        kind: 'clone_campaign',
        href: '/api/campaigns/c4/clone',
      },
      secondaryAction: undefined,
    });
  });

  test('buildCampaignDetailRoute shows an in-progress banner when the campaign is still processing', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns/:id': {
        status: 200,
        body: {
          campaign: {
            id: 'c5',
            title: 'Processing Campaign',
            videoAssetName: 'intro.mp4',
            status: 'launching',
            createdAt: '2026-04-01T00:00:00Z',
            targets: [
              {
                id: 't-processing',
                channelTitle: 'Main Channel',
                videoTitle: 'Uploading',
                status: 'enviando',
                youtubeVideoId: null,
                errorMessage: null,
              },
            ],
          },
        },
      },
      'GET /api/campaigns/:id/status': {
        status: 200,
        body: {
          campaignId: 'c5',
          campaignStatus: 'launching',
          shouldPoll: true,
          progress: { completed: 0, failed: 0, total: 1 },
          targets: [
            {
              targetId: 't-processing',
              channelId: 'ch-processing',
              videoTitle: 'Uploading',
              status: 'enviando',
              youtubeVideoId: null,
              errorMessage: null,
              latestJobStatus: 'processing',
              hasPostUploadWarning: false,
              reviewYoutubeUrl: null,
            },
          ],
        },
      },
      'GET /api/campaigns/c5/jobs': {
        status: 200,
        body: {
          jobsByTarget: {
            't-processing': [
              {
                id: 'job-processing-1',
                campaignTargetId: 't-processing',
                status: 'processing',
                attempt: 1,
                progressPercent: 50,
                youtubeVideoId: null,
                errorMessage: null,
                startedAt: '2026-04-01T00:01:00Z',
                completedAt: null,
                createdAt: '2026-04-01T00:00:00Z',
              },
            ],
          },
        },
      },
    });

    const view = await buildCampaignDetailRoute({
      params: { campaignId: 'c5' },
      fetcher,
    });

    expect(view.page?.polling.enabled).toBe(true);
    expect(view.operationalOverview?.lifecycleState).toBe('launching');
    expect(view.summary).toEqual({
      totalTargets: 1,
      retryAvailableCount: 0,
      postUploadWarningCount: 0,
      targetsWithHistoryCount: 1,
      manualAttentionCount: 0,
      inProgressCount: 1,
    });
    expect(view.operationalOverview?.attentionState).toBe('in_progress');
    expect(view.operationalOverview?.dominantAttentionReason).toBe('in_progress');
    expect(view.operationalOverview?.primaryAction).toEqual({
      kind: 'refresh_status',
      href: '/api/campaigns/c5/status',
    });
    expect(view.operationalOverview?.attentionCounts).toEqual({
      review_required: 0,
      retry_available: 0,
      manual_attention: 0,
      in_progress: 1,
    });
    expect(view.operationalOverview?.attentionTargets).toEqual({
      review_required: [],
      retry_available: [],
      manual_attention: [],
      in_progress: ['t-processing'],
    });
    expect(view.priorityTargets).toEqual([
      {
        targetId: 't-processing',
        reason: 'in_progress',
      },
    ]);
    expect(view.statusBanner).toEqual({
      kind: 'in_progress',
      tone: 'neutral',
      title: 'Campaign is in progress',
      body: '1 target is still processing.',
      targetCount: 1,
      targetIds: ['t-processing'],
      primaryAction: {
        kind: 'refresh_status',
        href: '/api/campaigns/c5/status',
      },
      secondaryAction: undefined,
    });
  });

  test('buildCampaignDetailRoute still exposes in-progress overview when polling is active but no job history exists yet', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns/:id': {
        status: 200,
        body: {
          campaign: {
            id: 'c7',
            title: 'Queued Campaign',
            videoAssetName: 'intro.mp4',
            status: 'launching',
            createdAt: '2026-04-01T00:00:00Z',
            targets: [
              {
                id: 't-queued',
                channelTitle: 'Main Channel',
                videoTitle: 'Queued Upload',
                status: 'aguardando',
                youtubeVideoId: null,
                errorMessage: null,
              },
            ],
          },
        },
      },
      'GET /api/campaigns/:id/status': {
        status: 200,
        body: {
          campaignId: 'c7',
          campaignStatus: 'launching',
          shouldPoll: true,
          progress: { completed: 0, failed: 0, total: 1 },
          targets: [
            {
              targetId: 't-queued',
              channelId: 'ch-queued',
              videoTitle: 'Queued Upload',
              status: 'aguardando',
              youtubeVideoId: null,
              errorMessage: null,
              latestJobStatus: 'queued',
              hasPostUploadWarning: false,
              reviewYoutubeUrl: null,
            },
          ],
        },
      },
      'GET /api/campaigns/c7/jobs': {
        status: 200,
        body: {
          jobsByTarget: {
            't-queued': [],
          },
        },
      },
    });

    const view = await buildCampaignDetailRoute({
      params: { campaignId: 'c7' },
      fetcher,
    });

    expect(view.page?.polling.enabled).toBe(true);
    expect(view.targetHistorySummary).toBeUndefined();
    expect(view.operationalOverview).toEqual({
      lifecycleState: 'launching',
      latestExecution: undefined,
      latestFailure: undefined,
      latestSuccess: undefined,
      primaryAction: {
        kind: 'refresh_status',
        href: '/api/campaigns/c7/status',
      },
      secondaryAction: undefined,
      dominantAttentionReason: 'in_progress',
      attentionCounts: {
        review_required: 0,
        retry_available: 0,
        manual_attention: 0,
        in_progress: 1,
      },
      attentionTargets: {
        review_required: [],
        retry_available: [],
        manual_attention: [],
        in_progress: ['t-queued'],
      },
      attentionState: 'in_progress',
    });
    expect(view.statusBanner).toEqual({
      kind: 'in_progress',
      tone: 'neutral',
      title: 'Campaign is in progress',
      body: '1 target is still processing.',
      targetCount: 1,
      targetIds: ['t-queued'],
      primaryAction: {
        kind: 'refresh_status',
        href: '/api/campaigns/c7/status',
      },
      secondaryAction: undefined,
    });
  });

  test('buildCampaignDetailRoute still exposes stable overview when no job history exists but no attention is required', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns/:id': {
        status: 200,
        body: {
          campaign: {
            id: 'c8',
            title: 'Stable Without History Campaign',
            videoAssetName: 'intro.mp4',
            status: 'completed',
            createdAt: '2026-04-01T00:00:00Z',
            targets: [
              {
                id: 't-stable-no-history',
                channelTitle: 'Main Channel',
                videoTitle: 'Published',
                status: 'publicado',
                youtubeVideoId: 'yt-stable-8',
                errorMessage: null,
              },
            ],
          },
        },
      },
      'GET /api/campaigns/:id/status': {
        status: 200,
        body: {
          campaignId: 'c8',
          campaignStatus: 'completed',
          shouldPoll: false,
          progress: { completed: 1, failed: 0, total: 1 },
          targets: [
            {
              targetId: 't-stable-no-history',
              channelId: 'ch-stable-8',
              videoTitle: 'Published',
              status: 'publicado',
              youtubeVideoId: 'yt-stable-8',
              errorMessage: null,
              latestJobStatus: 'completed',
              hasPostUploadWarning: false,
              reviewYoutubeUrl: null,
            },
          ],
        },
      },
      'GET /api/campaigns/c8/jobs': {
        status: 200,
        body: {
          jobsByTarget: {
            't-stable-no-history': [],
          },
        },
      },
    });

    const view = await buildCampaignDetailRoute({
      params: { campaignId: 'c8' },
      fetcher,
    });

    expect(view.page?.polling.enabled).toBe(false);
    expect(view.targetHistorySummary).toBeUndefined();
    expect(view.operationalOverview).toEqual({
      lifecycleState: 'completed',
      latestExecution: undefined,
      latestFailure: undefined,
      latestSuccess: undefined,
      primaryAction: {
        kind: 'clone_campaign',
        href: '/api/campaigns/c8/clone',
      },
      secondaryAction: undefined,
      dominantAttentionReason: undefined,
      attentionCounts: {
        review_required: 0,
        retry_available: 0,
        manual_attention: 0,
        in_progress: 0,
      },
      attentionTargets: {
        review_required: [],
        retry_available: [],
        manual_attention: [],
        in_progress: [],
      },
      attentionState: 'stable',
    });
    expect(view.statusBanner).toEqual({
      kind: 'stable',
      tone: 'success',
      title: 'Campaign is stable',
      body: 'No targets currently require review or retry.',
      targetCount: 0,
      targetIds: [],
      primaryAction: {
        kind: 'clone_campaign',
        href: '/api/campaigns/c8/clone',
      },
      secondaryAction: undefined,
    });
  });

  test('buildCampaignDetailRoute shows a ready-to-launch banner for ready campaigns before launch starts', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns/:id': {
        status: 200,
        body: {
          campaign: {
            id: 'c9',
            title: 'Ready Campaign',
            videoAssetName: 'intro.mp4',
            status: 'ready',
            createdAt: '2026-04-01T00:00:00Z',
            targets: [
              {
                id: 't-ready',
                channelTitle: 'Main Channel',
                videoTitle: 'Prepared Upload',
                status: 'aguardando',
                youtubeVideoId: null,
                errorMessage: null,
              },
            ],
          },
        },
      },
      'GET /api/campaigns/:id/status': {
        status: 200,
        body: {
          campaignId: 'c9',
          campaignStatus: 'ready',
          shouldPoll: false,
          progress: { completed: 0, failed: 0, total: 1 },
          targets: [
            {
              targetId: 't-ready',
              channelId: 'ch-ready',
              videoTitle: 'Prepared Upload',
              status: 'aguardando',
              youtubeVideoId: null,
              errorMessage: null,
              latestJobStatus: 'queued',
              hasPostUploadWarning: false,
              reviewYoutubeUrl: null,
            },
          ],
        },
      },
      'GET /api/campaigns/c9/jobs': {
        status: 200,
        body: {
          jobsByTarget: {
            't-ready': [],
          },
        },
      },
    });

    const view = await buildCampaignDetailRoute({
      params: { campaignId: 'c9' },
      fetcher,
    });

    expect(view.page?.polling.enabled).toBe(false);
    expect(view.summary).toEqual({
      totalTargets: 1,
      retryAvailableCount: 0,
      postUploadWarningCount: 0,
      targetsWithHistoryCount: 0,
      manualAttentionCount: 0,
      inProgressCount: 0,
    });
    expect(view.actions).toEqual({
      refreshHref: '/api/campaigns/c9/status',
      markReadyHref: undefined,
      launchHref: '/api/campaigns/c9/launch',
      deleteHref: '/api/campaigns/c9',
      cloneHref: '/api/campaigns/c9/clone',
    });
    expect(view.operationalOverview).toEqual({
      lifecycleState: 'ready',
      latestExecution: undefined,
      latestFailure: undefined,
      latestSuccess: undefined,
      primaryAction: {
        kind: 'launch_campaign',
        href: '/api/campaigns/c9/launch',
      },
      secondaryAction: undefined,
      dominantAttentionReason: undefined,
      attentionCounts: {
        review_required: 0,
        retry_available: 0,
        manual_attention: 0,
        in_progress: 0,
      },
      attentionTargets: {
        review_required: [],
        retry_available: [],
        manual_attention: [],
        in_progress: [],
      },
      attentionState: 'stable',
    });
    expect(view.operationalOverview?.attentionState).toBe('stable');
    expect(view.statusBanner).toEqual({
      kind: 'ready',
      tone: 'neutral',
      title: 'Campaign is ready to launch',
      body: '1 target is configured and waiting for launch.',
      targetCount: 1,
      targetIds: ['t-ready'],
      primaryAction: {
        kind: 'launch_campaign',
        href: '/api/campaigns/c9/launch',
      },
      secondaryAction: undefined,
    });
  });

  test('buildCampaignDetailRoute does not expose launch actions for ready campaigns without targets', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns/:id': {
        status: 200,
        body: {
          campaign: {
            id: 'c9-empty',
            title: 'Empty Ready Campaign',
            videoAssetName: 'intro.mp4',
            status: 'ready',
            createdAt: '2026-04-01T00:00:00Z',
            targets: [],
          },
        },
      },
      'GET /api/campaigns/:id/status': {
        status: 200,
        body: {
          campaignId: 'c9-empty',
          campaignStatus: 'ready',
          shouldPoll: false,
          progress: { completed: 0, failed: 0, total: 0 },
          targets: [],
        },
      },
      'GET /api/campaigns/c9-empty/jobs': {
        status: 200,
        body: {
          jobsByTarget: {},
        },
      },
    });

    const view = await buildCampaignDetailRoute({
      params: { campaignId: 'c9-empty' },
      fetcher,
    });

    expect(view.summary).toEqual({
      totalTargets: 0,
      retryAvailableCount: 0,
      postUploadWarningCount: 0,
      targetsWithHistoryCount: 0,
      manualAttentionCount: 0,
      inProgressCount: 0,
    });
    expect(view.actions).toEqual({
      refreshHref: '/api/campaigns/c9-empty/status',
      markReadyHref: undefined,
      launchHref: undefined,
      deleteHref: '/api/campaigns/c9-empty',
      cloneHref: '/api/campaigns/c9-empty/clone',
    });
    expect(view.recommendedActions).toEqual([]);
    expect(view.operationalOverview).toBeUndefined();
    expect(view.statusBanner).toBeUndefined();
  });

  test('buildCampaignDetailRoute shows a draft banner before launch configuration is complete', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns/:id': {
        status: 200,
        body: {
          campaign: {
            id: 'c10',
            title: 'Draft Campaign',
            videoAssetName: 'intro.mp4',
            status: 'draft',
            createdAt: '2026-04-01T00:00:00Z',
            targets: [],
          },
        },
      },
      'GET /api/campaigns/:id/status': {
        status: 200,
        body: {
          campaignId: 'c10',
          campaignStatus: 'draft',
          shouldPoll: false,
          progress: { completed: 0, failed: 0, total: 0 },
          targets: [],
        },
      },
      'GET /api/campaigns/c10/jobs': {
        status: 200,
        body: {
          jobsByTarget: {},
        },
      },
    });

    const view = await buildCampaignDetailRoute({
      params: { campaignId: 'c10' },
      fetcher,
    });

    expect(view.page?.polling.enabled).toBe(false);
    expect(view.summary).toEqual({
      totalTargets: 0,
      retryAvailableCount: 0,
      postUploadWarningCount: 0,
      targetsWithHistoryCount: 0,
      manualAttentionCount: 0,
      inProgressCount: 0,
    });
    expect(view.actions).toEqual({
      refreshHref: '/api/campaigns/c10/status',
      markReadyHref: undefined,
      launchHref: undefined,
      deleteHref: '/api/campaigns/c10',
      cloneHref: '/api/campaigns/c10/clone',
    });
    expect(view.operationalOverview).toEqual({
      lifecycleState: 'draft',
      latestExecution: undefined,
      latestFailure: undefined,
      latestSuccess: undefined,
      primaryAction: undefined,
      secondaryAction: undefined,
      dominantAttentionReason: undefined,
      attentionCounts: {
        review_required: 0,
        retry_available: 0,
        manual_attention: 0,
        in_progress: 0,
      },
      attentionTargets: {
        review_required: [],
        retry_available: [],
        manual_attention: [],
        in_progress: [],
      },
      attentionState: 'stable',
    });
    expect(view.statusBanner).toEqual({
      kind: 'draft',
      tone: 'neutral',
      title: 'Campaign is still a draft',
      body: 'Finish configuring targets and metadata before launch.',
      targetCount: 0,
      targetIds: [],
      primaryAction: undefined,
      secondaryAction: undefined,
    });
  });

  test('buildCampaignDetailRoute exposes mark-ready action for a configured draft campaign', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns/:id': {
        status: 200,
        body: {
          campaign: {
            id: 'c11',
            title: 'Configured Draft Campaign',
            videoAssetName: 'intro.mp4',
            status: 'draft',
            createdAt: '2026-04-01T00:00:00Z',
            targets: [
              {
                id: 't-draft-ready',
                channelTitle: 'Main Channel',
                videoTitle: 'Prepared Upload',
                status: 'aguardando',
                youtubeVideoId: null,
                errorMessage: null,
              },
            ],
          },
        },
      },
      'GET /api/campaigns/:id/status': {
        status: 200,
        body: {
          campaignId: 'c11',
          campaignStatus: 'draft',
          shouldPoll: false,
          progress: { completed: 0, failed: 0, total: 1 },
          targets: [
            {
              targetId: 't-draft-ready',
              channelId: 'ch-draft-ready',
              videoTitle: 'Prepared Upload',
              status: 'aguardando',
              youtubeVideoId: null,
              errorMessage: null,
              latestJobStatus: 'queued',
              hasPostUploadWarning: false,
              reviewYoutubeUrl: null,
            },
          ],
        },
      },
      'GET /api/campaigns/c11/jobs': {
        status: 200,
        body: {
          jobsByTarget: {
            't-draft-ready': [],
          },
        },
      },
    });

    const view = await buildCampaignDetailRoute({
      params: { campaignId: 'c11' },
      fetcher,
    });

    expect(view.actions).toEqual({
      refreshHref: '/api/campaigns/c11/status',
      markReadyHref: '/api/campaigns/c11/ready',
      launchHref: undefined,
      deleteHref: '/api/campaigns/c11',
      cloneHref: '/api/campaigns/c11/clone',
    });
    expect(view.operationalOverview).toEqual({
      lifecycleState: 'draft',
      latestExecution: undefined,
      latestFailure: undefined,
      latestSuccess: undefined,
      primaryAction: {
        kind: 'mark_ready',
        href: '/api/campaigns/c11/ready',
      },
      secondaryAction: undefined,
      dominantAttentionReason: undefined,
      attentionCounts: {
        review_required: 0,
        retry_available: 0,
        manual_attention: 0,
        in_progress: 0,
      },
      attentionTargets: {
        review_required: [],
        retry_available: [],
        manual_attention: [],
        in_progress: [],
      },
      attentionState: 'stable',
    });
    expect(view.statusBanner).toEqual({
      kind: 'draft',
      tone: 'neutral',
      title: 'Campaign is still a draft',
      body: '1 target is configured. Mark the campaign ready before launch.',
      targetCount: 1,
      targetIds: ['t-draft-ready'],
      primaryAction: {
        kind: 'mark_ready',
        href: '/api/campaigns/c11/ready',
      },
      secondaryAction: undefined,
    });
  });

  test('buildCampaignDetailRoute shows a scheduled banner for future publishAt targets waiting to run', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns/:id': {
        status: 200,
        body: {
          campaign: {
            id: 'c12-scheduled',
            title: 'Scheduled Campaign',
            videoAssetName: 'intro.mp4',
            status: 'launching',
            createdAt: '2026-04-01T00:00:00Z',
            targets: [
              {
                id: 't-scheduled',
                channelTitle: 'Main Channel',
                videoTitle: 'Scheduled Upload',
                status: 'aguardando',
                youtubeVideoId: null,
                errorMessage: null,
              },
            ],
          },
        },
      },
      'GET /api/campaigns/:id/status': {
        status: 200,
        body: {
          campaignId: 'c12-scheduled',
          campaignStatus: 'launching',
          shouldPoll: false,
          nextScheduledAt: '2026-04-10T18:00:00Z',
          progress: { completed: 0, failed: 0, total: 1 },
          targets: [
            {
              targetId: 't-scheduled',
              channelId: 'ch-scheduled',
              videoTitle: 'Scheduled Upload',
              status: 'aguardando',
              publishAt: '2026-04-10T18:00:00Z',
              scheduledPending: true,
              youtubeVideoId: null,
              errorMessage: null,
              latestJobStatus: null,
              hasPostUploadWarning: false,
              reviewYoutubeUrl: null,
            },
          ],
        },
      },
      'GET /api/campaigns/c12-scheduled/jobs': {
        status: 200,
        body: {
          jobsByTarget: {
            't-scheduled': [],
          },
        },
      },
    });

    const view = await buildCampaignDetailRoute({
      params: { campaignId: 'c12-scheduled' },
      fetcher,
      now: () => new Date('2026-04-10T16:00:00Z'),
    });

    expect(view.page?.detail.targets[0].scheduledPending).toBe(true);
    expect(view.page?.polling.enabled).toBe(false);
    expect(view.page?.polling.nextScheduledAt).toBe('2026-04-10T18:00:00Z');
    expect(view.summary).toEqual({
      totalTargets: 1,
      retryAvailableCount: 0,
      postUploadWarningCount: 0,
      targetsWithHistoryCount: 0,
      manualAttentionCount: 0,
      inProgressCount: 0,
    });
    expect(view.actions).toEqual({
      refreshHref: '/api/campaigns/c12-scheduled/status',
      nextRefreshAt: '2026-04-10T18:00:00Z',
      markReadyHref: undefined,
      launchHref: undefined,
      cloneHref: '/api/campaigns/c12-scheduled/clone',
    });
    expect(view.operationalOverview?.attentionState).toBe('scheduled');
    expect(view.operationalOverview?.dominantAttentionReason).toBe('scheduled');
    expect(view.operationalOverview?.scheduledCount).toBe(1);
    expect(view.operationalOverview?.scheduledTargetIds).toEqual(['t-scheduled']);
    expect(view.operationalOverview?.nextScheduledAt).toBe('2026-04-10T18:00:00Z');
    expect(view.operationalOverview?.primaryAction).toEqual({
      kind: 'refresh_status',
      href: '/api/campaigns/c12-scheduled/status',
    });
    expect(view.statusBanner).toEqual({
      kind: 'scheduled',
      tone: 'neutral',
      title: 'Campaign has scheduled targets',
      body: '1 target is waiting for scheduled publish time.',
      targetCount: 1,
      targetIds: ['t-scheduled'],
      nextScheduledAt: '2026-04-10T18:00:00Z',
      primaryAction: {
        kind: 'refresh_status',
        href: '/api/campaigns/c12-scheduled/status',
      },
      secondaryAction: undefined,
    });
  });

  test('buildCampaignDetailRoute shows a failed banner when targets failed without review or retry actions', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns/:id': {
        status: 200,
        body: {
          campaign: {
            id: 'c6',
            title: 'Manual Attention Campaign',
            videoAssetName: 'intro.mp4',
            status: 'failed',
            createdAt: '2026-04-01T00:00:00Z',
            targets: [
              {
                id: 't-failed',
                channelTitle: 'Main Channel',
                videoTitle: 'Upload',
                status: 'erro',
                youtubeVideoId: null,
                errorMessage: 'quotaExceeded',
                retryCount: 3,
                maxRetries: 3,
              },
            ],
          },
        },
      },
      'GET /api/campaigns/:id/status': {
        status: 200,
        body: {
          campaignId: 'c6',
          campaignStatus: 'failed',
          shouldPoll: false,
          progress: { completed: 0, failed: 1, total: 1 },
          targets: [
            {
              targetId: 't-failed',
              channelId: 'ch-failed',
              videoTitle: 'Upload',
              status: 'erro',
              youtubeVideoId: null,
              errorMessage: 'quotaExceeded',
              latestJobStatus: 'failed',
              hasPostUploadWarning: false,
              reviewYoutubeUrl: null,
            },
          ],
        },
      },
      'GET /api/campaigns/c6/jobs': {
        status: 200,
        body: {
          jobsByTarget: {
            't-failed': [
              {
                id: 'job-failed-1',
                campaignTargetId: 't-failed',
                status: 'failed',
                attempt: 3,
                progressPercent: 100,
                youtubeVideoId: null,
                errorMessage: 'quotaExceeded',
                startedAt: '2026-04-01T00:01:00Z',
                completedAt: null,
                createdAt: '2026-04-01T00:00:00Z',
              },
            ],
          },
        },
      },
    });

    const view = await buildCampaignDetailRoute({
      params: { campaignId: 'c6' },
      fetcher,
    });

    expect(view.operationalOverview?.attentionState).toBe('manual_attention');
    expect(view.operationalOverview?.lifecycleState).toBe('failed');
    expect(view.summary).toEqual({
      totalTargets: 1,
      retryAvailableCount: 0,
      postUploadWarningCount: 0,
      targetsWithHistoryCount: 1,
      manualAttentionCount: 1,
      inProgressCount: 0,
    });
    expect(view.operationalOverview?.dominantAttentionReason).toBe('manual_attention');
    expect(view.operationalOverview?.attentionCounts).toEqual({
      review_required: 0,
      retry_available: 0,
      manual_attention: 1,
      in_progress: 0,
    });
    expect(view.operationalOverview?.attentionTargets).toEqual({
      review_required: [],
      retry_available: [],
      manual_attention: ['t-failed'],
      in_progress: [],
    });
    expect(view.priorityTargets).toEqual([
      {
        targetId: 't-failed',
        reason: 'manual_attention',
      },
    ]);
    expect(view.statusBanner).toEqual({
      kind: 'manual_attention',
      tone: 'warning',
      title: 'Campaign has failed targets',
      body: '1 target failed and needs manual attention.',
      targetCount: 1,
      targetIds: ['t-failed'],
      primaryAction: undefined,
      secondaryAction: undefined,
    });
  });

  test('buildCampaignDetailRoute treats explicit reauth-required targets as manual attention and disables retry', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns/:id': {
        status: 200,
        body: {
          campaign: {
            id: 'c6-reauth',
            title: 'Reconnect Needed Campaign',
            videoAssetName: 'intro.mp4',
            status: 'failed',
            createdAt: '2026-04-01T00:00:00Z',
            targets: [
              {
                id: 't-reauth',
                channelTitle: 'Main Channel',
                videoTitle: 'Upload',
                status: 'erro',
                youtubeVideoId: null,
                errorMessage: 'REAUTH_REQUIRED',
                retryCount: 0,
                maxRetries: 3,
              },
            ],
          },
        },
      },
      'GET /api/campaigns/:id/status': {
        status: 200,
        body: {
          campaignId: 'c6-reauth',
          campaignStatus: 'failed',
          shouldPoll: false,
          progress: { completed: 0, failed: 1, total: 1 },
          targets: [
            {
              targetId: 't-reauth',
              channelId: 'ch-reauth',
              videoTitle: 'Upload',
              status: 'erro',
              youtubeVideoId: null,
              errorMessage: 'REAUTH_REQUIRED',
              latestJobStatus: 'failed',
              publishAt: null,
              scheduledPending: false,
              reauthRequired: true,
              hasPostUploadWarning: false,
              reviewYoutubeUrl: null,
            },
          ],
        },
      },
      'GET /api/campaigns/c6-reauth/jobs': {
        status: 200,
        body: {
          jobsByTarget: {
            't-reauth': [
              {
                id: 'job-reauth-1',
                campaignTargetId: 't-reauth',
                status: 'failed',
                attempt: 1,
                progressPercent: 100,
                youtubeVideoId: null,
                errorMessage: 'REAUTH_REQUIRED',
                startedAt: '2026-04-01T00:01:00Z',
                completedAt: null,
                createdAt: '2026-04-01T00:00:00Z',
              },
            ],
          },
        },
      },
    });

    const view = await buildCampaignDetailRoute({
      params: { campaignId: 'c6-reauth' },
      fetcher,
    });

    expect(view.page?.detail.targets[0]).toMatchObject({
      reauthRequired: true,
      retryAvailable: false,
      errorMessage: 'REAUTH_REQUIRED',
    });
    expect(view.summary).toEqual({
      totalTargets: 1,
      retryAvailableCount: 0,
      postUploadWarningCount: 0,
      targetsWithHistoryCount: 1,
      manualAttentionCount: 1,
      inProgressCount: 0,
    });
    expect(view.operationalOverview?.attentionState).toBe('manual_attention');
    expect(view.priorityTargets).toEqual([
      {
        targetId: 't-reauth',
        reason: 'manual_attention',
      },
    ]);
    expect(view.recommendedActions).toEqual([
      {
        kind: 'reauth_account',
        targetId: 't-reauth',
        href: '/workspace/accounts',
      },
    ]);
    expect(view.targetActions).toEqual([
      {
        targetId: 't-reauth',
        historyHref: '/api/campaigns/c6-reauth/targets/t-reauth/jobs',
        retryHref: undefined,
        reviewHref: undefined,
        reauthHref: '/workspace/accounts',
      },
    ]);
    expect(view.statusBanner).toEqual({
      kind: 'manual_attention',
      tone: 'warning',
      title: 'Campaign has targets requiring reauthorization',
      body: '1 target is blocked until its connected account is reauthorized.',
      targetCount: 1,
      targetIds: ['t-reauth'],
      primaryAction: {
        kind: 'reauth_account',
        targetId: 't-reauth',
        href: '/workspace/accounts',
      },
      secondaryAction: undefined,
    });
  });

  test('buildCampaignDetailRoute shows a failed campaign banner even when no targets were processed', async () => {
    const fetcher = mockFetcher({
      'GET /api/campaigns/:id': {
        status: 200,
        body: {
          campaign: {
            id: 'c13',
            title: 'Failed Before Processing',
            videoAssetName: 'intro.mp4',
            status: 'failed',
            createdAt: '2026-04-01T00:00:00Z',
            targets: [],
          },
        },
      },
      'GET /api/campaigns/:id/status': {
        status: 200,
        body: {
          campaignId: 'c13',
          campaignStatus: 'failed',
          shouldPoll: false,
          progress: { completed: 0, failed: 0, total: 0 },
          targets: [],
        },
      },
      'GET /api/campaigns/c13/jobs': {
        status: 200,
        body: {
          jobsByTarget: {},
        },
      },
    });

    const view = await buildCampaignDetailRoute({
      params: { campaignId: 'c13' },
      fetcher,
    });

    expect(view.summary).toEqual({
      totalTargets: 0,
      retryAvailableCount: 0,
      postUploadWarningCount: 0,
      targetsWithHistoryCount: 0,
      manualAttentionCount: 0,
      inProgressCount: 0,
    });
    expect(view.operationalOverview).toEqual({
      lifecycleState: 'failed',
      latestExecution: undefined,
      latestFailure: undefined,
      latestSuccess: undefined,
      primaryAction: undefined,
      secondaryAction: undefined,
      dominantAttentionReason: 'manual_attention',
      attentionCounts: {
        review_required: 0,
        retry_available: 0,
        manual_attention: 0,
        in_progress: 0,
      },
      attentionTargets: {
        review_required: [],
        retry_available: [],
        manual_attention: [],
        in_progress: [],
      },
      attentionState: 'manual_attention',
    });
    expect(view.statusBanner).toEqual({
      kind: 'manual_attention',
      tone: 'warning',
      title: 'Campaign failed before processing targets',
      body: 'No targets were processed. Review campaign configuration or launch conditions before retrying.',
      targetCount: 0,
      targetIds: [],
      primaryAction: undefined,
      secondaryAction: undefined,
    });
  });
});
