import { describe, expect, test } from 'vitest';

import {
  buildCampaignDetailView,
  type CampaignDetailData,
} from '../../apps/web/components/campaigns/campaign-detail';

describe('campaign detail view', () => {
  const baseCampaign: CampaignDetailData = {
    id: 'camp-1',
    title: 'My Launch',
    videoAssetName: 'intro.mp4',
    status: 'launching',
    targets: [
      {
        id: 'target-1',
        channelTitle: 'Main Channel',
        videoTitle: 'First Upload',
        status: 'enviando',
        youtubeVideoId: null,
        errorMessage: null,
      },
      {
        id: 'target-2',
        channelTitle: 'Second Channel',
        videoTitle: 'Second Upload',
        status: 'aguardando',
        youtubeVideoId: null,
        errorMessage: null,
      },
    ],
    createdAt: '2026-04-01T00:00:00Z',
  };

  test('renders campaign header with title and status', () => {
    const view = buildCampaignDetailView(baseCampaign);

    expect(view.header.title).toBe('My Launch');
    expect(view.header.status).toBe('launching');
    expect(view.header.videoAssetName).toBe('intro.mp4');
  });

  test('renders target rows with per-target status', () => {
    const view = buildCampaignDetailView(baseCampaign);

    expect(view.targets).toHaveLength(2);
    expect(view.targets[0].channelTitle).toBe('Main Channel');
    expect(view.targets[0].status).toBe('enviando');
    expect(view.targets[1].status).toBe('aguardando');
  });

  test('shows YouTube link when target is published', () => {
    const data: CampaignDetailData = {
      ...baseCampaign,
      status: 'completed',
      targets: [
        {
          id: 'target-1',
          channelTitle: 'Main Channel',
          videoTitle: 'Published Video',
          status: 'publicado',
          youtubeVideoId: 'yt-abc123',
          errorMessage: null,
        },
      ],
    };

    const view = buildCampaignDetailView(data);
    expect(view.targets[0].youtubeUrl).toBe('https://www.youtube.com/watch?v=yt-abc123');
  });

  test('shows error message when target failed', () => {
    const data: CampaignDetailData = {
      ...baseCampaign,
      status: 'failed',
      targets: [
        {
          id: 'target-1',
          channelTitle: 'Main Channel',
          videoTitle: 'Failed Video',
          status: 'erro',
          youtubeVideoId: null,
          errorMessage: 'quotaExceeded',
        },
      ],
    };

    const view = buildCampaignDetailView(data);
    expect(view.targets[0].errorMessage).toBe('quotaExceeded');
  });

  test('shows uploaded video review link when target failed after a partial post-upload step', () => {
    const data: CampaignDetailData = {
      ...baseCampaign,
      status: 'failed',
      targets: [
        {
          id: 'target-1',
          channelTitle: 'Main Channel',
          videoTitle: 'Partial Failure Video',
          status: 'erro',
          youtubeVideoId: 'yt-partial-123',
          errorMessage: 'Video uploaded as yt-partial-123, but adding it to playlist failed: forbidden',
        },
      ],
    };

    const view = buildCampaignDetailView(data);
    expect(view.targets[0].youtubeUrl).toBeUndefined();
    expect(view.targets[0].partialFailureYoutubeUrl).toBe('https://www.youtube.com/watch?v=yt-partial-123');
    expect(view.targets[0].partialFailureWarning).toBe(
      'Upload completed, but a post-upload step failed. Review the published video before retrying.',
    );
  });

  test('prefers explicit partial-failure status metadata from the backend when present', () => {
    const data: CampaignDetailData = {
      ...baseCampaign,
      status: 'failed',
      targets: [
        {
          id: 'target-1',
          channelTitle: 'Main Channel',
          videoTitle: 'Partial Failure Video',
          status: 'erro',
          youtubeVideoId: 'yt-partial-999',
          errorMessage: 'generic failure text',
          hasPostUploadWarning: true,
          reviewYoutubeUrl: 'https://www.youtube.com/watch?v=yt-partial-999',
        },
      ],
    };

    const view = buildCampaignDetailView(data);
    expect(view.targets[0].partialFailureYoutubeUrl).toBe('https://www.youtube.com/watch?v=yt-partial-999');
    expect(view.targets[0].partialFailureWarning).toBe(
      'Upload completed, but a post-upload step failed. Review the published video before retrying.',
    );
  });

  test('prefers explicit reauth-required metadata from the backend and disables retry', () => {
    const data: CampaignDetailData = {
      ...baseCampaign,
      status: 'failed',
      targets: [
        {
          id: 'target-1',
          channelTitle: 'Main Channel',
          videoTitle: 'Reconnect Required',
          status: 'erro',
          youtubeVideoId: null,
          errorMessage: 'REAUTH_REQUIRED',
          reauthRequired: true,
          retryCount: 0,
          maxRetries: 3,
        },
      ],
    };

    const view = buildCampaignDetailView(data);
    expect(view.targets[0].reauthRequired).toBe(true);
    expect(view.targets[0].retryAvailable).toBe(false);
    expect(view.targets[0].errorMessage).toBe('REAUTH_REQUIRED');
  });

  test('enables polling when any target is aguardando or enviando', () => {
    const view = buildCampaignDetailView(baseCampaign);
    expect(view.pollingEnabled).toBe(true);
    expect(view.pollingIntervalMs).toBe(3000);
  });

  test('disables polling when all targets are terminal (publicado or erro)', () => {
    const data: CampaignDetailData = {
      ...baseCampaign,
      status: 'completed',
      targets: [
        {
          id: 'target-1',
          channelTitle: 'Main Channel',
          videoTitle: 'Done',
          status: 'publicado',
          youtubeVideoId: 'yt-1',
          errorMessage: null,
        },
      ],
    };

    const view = buildCampaignDetailView(data);
    expect(view.pollingEnabled).toBe(false);
  });

  test('disables polling for targets waiting on a future publishAt time', () => {
    const data: CampaignDetailData = {
      ...baseCampaign,
      status: 'launching',
      targets: [
        {
          id: 'target-scheduled',
          channelTitle: 'Scheduled Channel',
          videoTitle: 'Scheduled Upload',
          status: 'aguardando',
          publishAt: '2026-05-01T15:00:00Z',
          youtubeVideoId: null,
          errorMessage: null,
        },
      ],
    };

    const view = buildCampaignDetailView(data, {
      now: () => new Date('2026-04-01T00:00:00Z'),
    });

    expect(view.targets[0].scheduledPending).toBe(true);
    expect(view.pollingEnabled).toBe(false);
    expect(view.nextScheduledAt).toBe('2026-05-01T15:00:00Z');
  });

  test('progress shows count of completed targets', () => {
    const data: CampaignDetailData = {
      ...baseCampaign,
      targets: [
        {
          id: 't1',
          channelTitle: 'Ch1',
          videoTitle: 'V1',
          status: 'publicado',
          youtubeVideoId: 'yt-1',
          errorMessage: null,
        },
        {
          id: 't2',
          channelTitle: 'Ch2',
          videoTitle: 'V2',
          status: 'enviando',
          youtubeVideoId: null,
          errorMessage: null,
        },
      ],
    };

    const view = buildCampaignDetailView(data);
    expect(view.progress).toMatchObject({
      completed: 1,
      total: 2,
    });
  });
});
