import { describe, expect, test, vi } from 'vitest';

import {
  buildCampaignWizardView,
  submitCampaignWizardDraft,
  type CampaignWizardData,
  type CampaignWizardView,
} from '../../apps/web/components/campaigns/campaign-wizard';

import {
  buildCampaignListView,
  type CampaignListRow,
} from '../../apps/web/components/campaigns/campaign-list';

import {
  buildCampaignsPageView,
  type CampaignsPageData,
} from '../../apps/web/app/(admin)/workspace/campanhas/page';

describe('campaigns page view', () => {
  test('shows empty state when no campaigns exist', () => {
    const view = buildCampaignsPageView({ campaigns: [] });

    expect(view.actions).toEqual({
      createHref: '/workspace/campanhas/nova',
      createLabel: 'Create campaign',
    });
    expect(view.emptyState).toBeDefined();
    expect(view.emptyState!.heading).toBe('No campaigns yet');
    expect(view.emptyState!.cta).toBe('Create campaign');
    expect(view.emptyState!.ctaHref).toBe('/workspace/campanhas/nova');
  });

  test('shows a filtered empty state when no campaigns match the active filters', () => {
    const view = buildCampaignsPageView({
      campaigns: [],
      filters: {
        status: 'ready',
        search: 'launch',
      },
    });

    expect(view.emptyState).toBeDefined();
    expect(view.emptyState!.heading).toBe('No campaigns match the current filters');
    expect(view.emptyState!.body).toBe('Try clearing filters or adjusting your search.');
    expect(view.emptyState!.cta).toBe('Clear filters');
    expect(view.emptyState!.ctaHref).toBe('/workspace/campanhas');
    expect(view.emptyState!.clearFiltersHref).toBe('/workspace/campanhas');
  });

  test('shows a pagination empty state when the current page has no rows but earlier pages still exist', () => {
    const view = buildCampaignsPageView({
      campaigns: [],
      total: 31,
      limit: 10,
      offset: 40,
      filters: {
        status: 'ready',
        search: 'launch',
      },
    });

    expect(view.pagination).toEqual({
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
    expect(view.emptyState).toEqual({
      heading: 'No campaigns on this page',
      body: 'Go back to the previous page or adjust your filters.',
      cta: 'Previous page',
      ctaHref: '/workspace/campanhas?status=ready&search=launch&limit=10&offset=30',
      clearFiltersHref: '/workspace/campanhas?status=ready&search=launch&limit=10&offset=30',
    });
  });

  test('hides empty state when campaigns exist', () => {
    const view = buildCampaignsPageView({
      campaigns: [
        {
          id: 'camp-1',
          title: 'Launch video',
          videoAssetName: 'intro.mp4',
          targetCount: 2,
          status: 'draft',
          createdAt: '2026-04-01T00:00:00Z',
        },
      ],
    });

    expect(view.actions).toEqual({
      createHref: '/workspace/campanhas/nova',
      createLabel: 'Create campaign',
    });
    expect(view.emptyState).toBeUndefined();
    expect(view.list.rows).toHaveLength(1);
  });

  test('exposes pagination hrefs for an unfiltered campaign list', () => {
    const view = buildCampaignsPageView({
      campaigns: [
        {
          id: 'camp-1',
          title: 'Launch video',
          videoAssetName: 'intro.mp4',
          targetCount: 2,
          status: 'draft',
          createdAt: '2026-04-01T00:00:00Z',
        },
      ],
      total: 31,
      limit: 10,
      offset: 10,
    });

    expect(view.pagination).toEqual({
      total: 31,
      limit: 10,
      offset: 10,
      count: 1,
      hasPrevious: true,
      hasNext: true,
      previousOffset: 0,
      nextOffset: 20,
      previousHref: '/workspace/campanhas?limit=10&offset=0',
      nextHref: '/workspace/campanhas?limit=10&offset=20',
    });
  });
});

describe('campaign list view', () => {
  const campaignRow: CampaignListRow = {
    id: 'camp-1',
    title: 'Launch video',
    videoAssetName: 'intro.mp4',
    targetCount: 2,
    status: 'draft',
    createdAt: '2026-04-01T00:00:00Z',
  };

  test('renders campaign rows with title/status/targets', () => {
    const view = buildCampaignListView({ rows: [campaignRow] });

    expect(view.isEmpty).toBe(false);
    expect(view.rows).toHaveLength(1);
    expect(view.rows[0].title).toBe('Launch video');
    expect(view.rows[0].status).toBe('draft');
    expect(view.rows[0].targetCount).toBe(2);
  });

  test('columns include Title, Video, Targets, Status, Created', () => {
    const view = buildCampaignListView({ rows: [campaignRow] });
    expect(view.columns).toEqual(['Title', 'Video', 'Targets', 'Status', 'Created']);
  });

  test('isEmpty true for empty list', () => {
    const view = buildCampaignListView({ rows: [] });
    expect(view.isEmpty).toBe(true);
  });
});

describe('campaign wizard view', () => {
  const wizardData: CampaignWizardData = {
    availableVideos: [
      { id: 'v1', original_name: 'intro.mp4', duration_seconds: 120 },
      { id: 'v2', original_name: 'outro.mp4', duration_seconds: 60 },
    ],
    availableChannels: [
      { id: 'ch-1', title: 'Main Channel', thumbnailUrl: null, isActive: true },
      { id: 'ch-2', title: 'Second Channel', thumbnailUrl: null, isActive: true },
    ],
  };

  test('wizard has 4 steps in order', () => {
    const view = buildCampaignWizardView(wizardData);

    expect(view.steps).toHaveLength(4);
    expect(view.steps.map((s) => s.label)).toEqual([
      'Select video',
      'Select destinations',
      'Metadata',
      'Review & launch',
    ]);
  });

  test('starts at step 0 (select video)', () => {
    const view = buildCampaignWizardView(wizardData);
    expect(view.currentStep).toBe(0);
  });

  test('step 1 lists available videos with name and duration', () => {
    const view = buildCampaignWizardView(wizardData);
    const videoStep = view.steps[0];

    expect(videoStep.videos).toHaveLength(2);
    expect(videoStep.videos![0].original_name).toBe('intro.mp4');
    expect(videoStep.videos![0].duration_seconds).toBe(120);
  });

  test('step 2 lists available active channels', () => {
    const view = buildCampaignWizardView(wizardData);
    const channelStep = view.steps[1];

    expect(channelStep.channels).toHaveLength(2);
    expect(channelStep.channels![0].title).toBe('Main Channel');
  });

  test('step 3 has metadata fields per selected channel', () => {
    const view = buildCampaignWizardView({
      ...wizardData,
      selectedChannelIds: ['ch-1', 'ch-2'],
    });
    const metadataStep = view.steps[2];

    expect(metadataStep.metadataFields).toMatchObject({
      videoTitle: { required: true },
      videoDescription: { required: true },
      tags: { required: false },
      publishAt: { required: false },
      playlistId: { required: false },
      thumbnailAssetId: { required: false },
      privacy: { required: false, options: ['public', 'unlisted', 'private'] },
    });
    expect(metadataStep.channelMetadataSections).toEqual([
      {
        channelId: 'ch-1',
        channelTitle: 'Main Channel',
        thumbnailUrl: null,
        platform: 'youtube',
        metadataFields: {
          videoTitle: { required: true },
          videoDescription: { required: true },
          tags: { required: false },
          publishAt: { required: false },
          playlistId: { required: false },
          thumbnailAssetId: { required: false },
          privacy: { required: false, options: ['public', 'unlisted', 'private'] },
        },
      },
      {
        channelId: 'ch-2',
        channelTitle: 'Second Channel',
        thumbnailUrl: null,
        platform: 'youtube',
        metadataFields: {
          videoTitle: { required: true },
          videoDescription: { required: true },
          tags: { required: false },
          publishAt: { required: false },
          playlistId: { required: false },
          thumbnailAssetId: { required: false },
          privacy: { required: false, options: ['public', 'unlisted', 'private'] },
        },
      },
    ]);
  });

  test('step 4 is the review and launch step', () => {
    const view = buildCampaignWizardView(wizardData);
    const reviewStep = view.steps[3];

    expect(reviewStep.label).toBe('Review & launch');
    expect(reviewStep.confirmationMessage).toBe(
      'Tem certeza? Isso vai iniciar a publicacao nas plataformas selecionadas.',
    );
  });

  test('metadata step exposes Instagram Reels controls for selected Instagram destinations', () => {
    const view = buildCampaignWizardView({
      availableVideos: wizardData.availableVideos,
      availableChannels: [
        ...wizardData.availableChannels,
        {
          id: 'ig-1',
          title: '@studio',
          thumbnailUrl: null,
          isActive: true,
          platform: 'instagram',
          destinationId: 'ig-1',
          destinationLabel: '@studio',
          connectedAccountId: 'ig-1',
        },
      ],
      selectedChannelIds: ['ig-1'],
    });

    const metadataStep = view.steps[2];

    expect(metadataStep.metadataFields).toMatchObject({
      instagramCaption: { required: false },
      instagramShareToFeed: { required: false, options: ['true', 'false'] },
    });
    expect(metadataStep.channelMetadataSections).toEqual([
      {
        channelId: 'ig-1',
        channelTitle: '@studio',
        thumbnailUrl: null,
        platform: 'instagram',
        metadataFields: expect.objectContaining({
          videoTitle: { required: true },
          videoDescription: { required: true },
          instagramCaption: { required: false },
          instagramShareToFeed: { required: false, options: ['true', 'false'] },
        }),
      },
    ]);
  });

  test('step 4 includes a preflight summary when draft selections are available', () => {
    const view = buildCampaignWizardView({
      ...wizardData,
      review: {
        selectedVideoName: 'intro.mp4',
        selectedChannelTitles: ['Main Channel'],
        videoTitle: 'Launch Title',
        videoDescription: 'Launch Description',
        tags: ['alpha', 'beta'],
        publishAt: '2026-05-01T15:00:00Z',
        playlistId: 'playlist-123',
        privacy: 'unlisted',
        thumbnailAssetName: 'thumb.png',
      },
    });

    const reviewStep = view.steps[3];

    expect(reviewStep.reviewSummary).toEqual({
      selectedVideoName: 'intro.mp4',
      selectedChannelTitles: ['Main Channel'],
      videoTitle: 'Launch Title',
      videoDescription: 'Launch Description',
      tags: ['alpha', 'beta'],
      publishAt: '2026-05-01T15:00:00Z',
      playlistId: 'playlist-123',
      privacy: 'unlisted',
      thumbnailAssetName: 'thumb.png',
    });
  });

  test('step 4 derives a readable preflight checklist for optional metadata', () => {
    const view = buildCampaignWizardView({
      ...wizardData,
      review: {
        selectedVideoName: 'intro.mp4',
        selectedChannelTitles: ['Main Channel', 'Second Channel'],
        videoTitle: 'Launch Title',
        videoDescription: 'Launch Description',
        tags: [],
        publishAt: null,
        playlistId: null,
        privacy: 'private',
        thumbnailAssetName: null,
      },
    });

    const reviewStep = view.steps[3];

    expect(reviewStep.preflightChecklist).toEqual([
      { label: 'Video selected', value: 'intro.mp4' },
      { label: 'Channels selected', value: '2 channels' },
      { label: 'Target channels', value: 'Main Channel, Second Channel' },
      { label: 'Tags', value: 'Not configured' },
      { label: 'Publish time', value: 'Immediately' },
      { label: 'Playlist', value: 'Not configured' },
      { label: 'Thumbnail', value: 'Not configured' },
      { label: 'Privacy', value: 'private' },
    ]);
  });

  test('all steps are clickable for navigation', () => {
    const view = buildCampaignWizardView(wizardData);
    expect(view.steps.every((s) => s.clickable)).toBe(true);
  });

  test('auto-save produces draft status', () => {
    const view = buildCampaignWizardView(wizardData);
    expect(view.autoSaveDraftStatus).toBe('draft');
  });

  test('submits selected channels through bulk target creation when saving a wizard draft', async () => {
    const client = {
      createCampaign: vi.fn().mockResolvedValue({
        ok: true,
        campaign: { id: 'c1', title: 'Launch campaign', status: 'draft' },
      }),
      addTargets: vi.fn().mockResolvedValue({
        ok: true,
        targets: [
          { id: 't1', campaignId: 'c1', channelId: 'ch-1' },
          { id: 't2', campaignId: 'c1', channelId: 'ch-2' },
        ],
      }),
    };

    const result = await submitCampaignWizardDraft(client as any, {
      title: 'Launch campaign',
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
    });

    expect(client.createCampaign).toHaveBeenCalledWith({
      title: 'Launch campaign',
      videoAssetId: 'video-1',
      scheduledAt: '2026-05-10T10:00:00Z',
    });
    expect(client.addTargets).toHaveBeenCalledWith('c1', [
      {
        channelId: 'ch-1',
        videoTitle: 'Upload Title',
        videoDescription: 'Upload Description',
        tags: ['alpha'],
        publishAt: '2026-05-11T15:00:00Z',
        playlistId: 'playlist-1',
        privacy: 'unlisted',
        thumbnailAssetId: 'thumb-1',
      },
      {
        channelId: 'ch-2',
        videoTitle: 'Upload Title',
        videoDescription: 'Upload Description',
        tags: ['alpha'],
        publishAt: '2026-05-11T15:00:00Z',
        playlistId: 'playlist-1',
        privacy: 'unlisted',
        thumbnailAssetId: 'thumb-1',
      },
    ]);
    expect(result).toEqual({
      ok: true,
      campaign: { id: 'c1', title: 'Launch campaign', status: 'draft' },
      targets: [
        { id: 't1', campaignId: 'c1', channelId: 'ch-1' },
        { id: 't2', campaignId: 'c1', channelId: 'ch-2' },
      ],
    });
  });

  test('submits selected platform destinations with Instagram-specific metadata', async () => {
    const client = {
      createCampaign: vi.fn().mockResolvedValue({
        ok: true,
        campaign: { id: 'c1', title: 'Multi-platform campaign', status: 'draft' },
      }),
      addTargets: vi.fn().mockResolvedValue({
        ok: true,
        targets: [
          { id: 't-yt', campaignId: 'c1', channelId: 'ch-1', platform: 'youtube' },
          { id: 't-ig', campaignId: 'c1', destinationId: 'ig-1', platform: 'instagram' },
        ],
      }),
    };

    const result = await submitCampaignWizardDraft(client as any, {
      title: 'Multi-platform campaign',
      videoAssetId: 'video-1',
      selectedDestinations: [
        { id: 'ch-1', platform: 'youtube', destinationId: 'ch-1', destinationLabel: 'Main Channel' },
        {
          id: 'ig-1',
          platform: 'instagram',
          destinationId: 'ig-1',
          destinationLabel: '@studio',
          connectedAccountId: 'ig-1',
        },
      ],
      targetTemplate: {
        videoTitle: 'Upload Title',
        videoDescription: 'Upload Description',
        instagramCaption: 'Reels caption',
        instagramShareToFeed: false,
      },
    });

    expect(client.addTargets).toHaveBeenCalledWith('c1', [
      {
        channelId: 'ch-1',
        videoTitle: 'Upload Title',
        videoDescription: 'Upload Description',
      },
      {
        platform: 'instagram',
        destinationId: 'ig-1',
        destinationLabel: '@studio',
        connectedAccountId: 'ig-1',
        videoTitle: 'Upload Title',
        videoDescription: 'Upload Description',
        instagramCaption: 'Reels caption',
        instagramShareToFeed: false,
      },
    ]);
    expect(result).toEqual({
      ok: true,
      campaign: { id: 'c1', title: 'Multi-platform campaign', status: 'draft' },
      targets: [
        { id: 't-yt', campaignId: 'c1', channelId: 'ch-1', platform: 'youtube' },
        { id: 't-ig', campaignId: 'c1', destinationId: 'ig-1', platform: 'instagram' },
      ],
    });
  });

  test('skips bulk target creation when saving a draft without selected channels', async () => {
    const client = {
      createCampaign: vi.fn().mockResolvedValue({
        ok: true,
        campaign: { id: 'c1', title: 'Empty draft', status: 'draft' },
      }),
      addTargets: vi.fn(),
    };

    const result = await submitCampaignWizardDraft(client as any, {
      title: 'Empty draft',
      videoAssetId: 'video-1',
      selectedChannelIds: [],
      targetTemplate: {
        videoTitle: 'Upload Title',
        videoDescription: 'Upload Description',
      },
    });

    expect(client.createCampaign).toHaveBeenCalledWith({
      title: 'Empty draft',
      videoAssetId: 'video-1',
      scheduledAt: undefined,
    });
    expect(client.addTargets).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: true,
      campaign: { id: 'c1', title: 'Empty draft', status: 'draft' },
      targets: [],
    });
  });

  test('returns a create_campaign stage when draft creation fails', async () => {
    const client = {
      createCampaign: vi.fn().mockResolvedValue({
        ok: false,
        error: 'Title is required',
      }),
      addTargets: vi.fn(),
    };

    const result = await submitCampaignWizardDraft(client as any, {
      title: 'Broken draft',
      videoAssetId: 'video-1',
      selectedChannelIds: ['ch-1'],
      targetTemplate: {
        videoTitle: 'Upload Title',
        videoDescription: 'Upload Description',
      },
    });

    expect(client.addTargets).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      error: 'Title is required',
      stage: 'create_campaign',
    });
  });

  test('returns an add_targets stage when bulk target creation fails', async () => {
    const client = {
      createCampaign: vi.fn().mockResolvedValue({
        ok: true,
        campaign: { id: 'c1', title: 'Launch campaign', status: 'draft' },
      }),
      addTargets: vi.fn().mockResolvedValue({
        ok: false,
        error: 'Duplicate channelId in targets payload: ch-1',
      }),
    };

    const result = await submitCampaignWizardDraft(client as any, {
      title: 'Launch campaign',
      videoAssetId: 'video-1',
      selectedChannelIds: ['ch-1', 'ch-2'],
      targetTemplate: {
        videoTitle: 'Upload Title',
        videoDescription: 'Upload Description',
      },
    });

    expect(result).toEqual({
      ok: false,
      error: 'Duplicate channelId in targets payload: ch-1',
      stage: 'add_targets',
    });
  });
});

describe('workspace layout includes Campanhas tab', () => {
  test('buildWorkspaceLayout returns Campanhas as third tab', async () => {
    // Import the updated layout
    const { buildWorkspaceLayout } = await import(
      '../../apps/web/app/(admin)/workspace/layout'
    );

    const mockFetcher = async () => ({
      status: 200,
      json: async () => ({ user: { email: 'admin@example.com' } }),
    });
    const view = await buildWorkspaceLayout({ fetcher: mockFetcher as any });

    const tabIds = view.tabs?.map((t) => t.id);
    expect(tabIds).toContain('campanhas');

    const campanhasTab = view.tabs?.find((t) => t.id === 'campanhas');
    expect(campanhasTab?.label).toBe('Campanhas');
  });
});
