import { describe, expect, test, vi } from 'vitest';

import {
  campaignsApiClient,
  type CampaignsApiClient,
} from '../../apps/web/lib/campaigns-client';
import type { AuthFetch, AuthFetchResponse } from '../../apps/web/lib/auth-client';

function mockFetcher(responses: Record<string, { status: number; body: unknown }>): AuthFetch {
  return async (url: string, init?: any): Promise<AuthFetchResponse> => {
    const key = `${init?.method ?? 'GET'} ${url}`;
    const match = Object.entries(responses).find(([pattern]) => {
      if (pattern === key) return true;
      // Support patterns like "GET /api/campaigns/:id" matching "GET /api/campaigns/abc"
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

describe('campaignsApiClient', () => {
  test('listCampaigns fetches GET /api/campaigns and preserves pagination metadata', async () => {
    const client = campaignsApiClient(mockFetcher({
      'GET /api/campaigns': {
        status: 200,
        body: {
          campaigns: [{ id: 'c1', title: 'Test', status: 'draft' }],
          total: 1,
          limit: 20,
          offset: 0,
        },
      },
    }));

    const result = await client.listCampaigns();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.campaigns).toHaveLength(1);
      expect(result.campaigns[0].title).toBe('Test');
      expect(result.total).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.offset).toBe(0);
    }
  });

  test('listCampaigns appends supported filters and pagination as query params', async () => {
    const fetcher = vi.fn(mockFetcher({
      'GET /api/campaigns?status=ready&search=launch&limit=10&offset=20': {
        status: 200,
        body: {
          campaigns: [],
          total: 0,
          limit: 10,
          offset: 20,
        },
      },
    }));
    const client = campaignsApiClient(fetcher);

    const result = await client.listCampaigns({
      status: 'ready',
      search: 'launch',
      limit: 10,
      offset: 20,
    });

    expect(result.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledWith('/api/campaigns?status=ready&search=launch&limit=10&offset=20', expect.objectContaining({
      method: 'GET',
    }));
  });

  test('createCampaign posts to POST /api/campaigns', async () => {
    const client = campaignsApiClient(mockFetcher({
      'POST /api/campaigns': {
        status: 201,
        body: { campaign: { id: 'c1', title: 'New', status: 'draft' } },
      },
    }));

    const result = await client.createCampaign({ title: 'New', videoAssetId: 'v1' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.campaign.title).toBe('New');
  });

  test('getCampaign fetches GET /api/campaigns/:id', async () => {
    const client = campaignsApiClient(mockFetcher({
      'GET /api/campaigns/:id': {
        status: 200,
        body: { campaign: { id: 'c1', title: 'Detail' } },
      },
    }));

    const result = await client.getCampaign('c1');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.campaign.title).toBe('Detail');
  });

  test('launchCampaign posts to POST /api/campaigns/:id/launch', async () => {
    const client = campaignsApiClient(mockFetcher({
      'POST /api/campaigns/:id/launch': {
        status: 200,
        body: { campaign: { id: 'c1', title: 'Launchable', status: 'launching' } },
      },
    }));

    const result = await client.launchCampaign('c1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.campaign).toEqual({ id: 'c1', title: 'Launchable', status: 'launching' });
    }
  });

  test('markReadyCampaign posts to POST /api/campaigns/:id/ready', async () => {
    const client = campaignsApiClient(mockFetcher({
      'POST /api/campaigns/:id/ready': {
        status: 200,
        body: { campaign: { id: 'c1', title: 'Draft', status: 'ready' } },
      },
    }));

    const result = await client.markReadyCampaign('c1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.campaign).toEqual({ id: 'c1', title: 'Draft', status: 'ready' });
    }
  });

  test('cloneCampaign posts to POST /api/campaigns/:id/clone with an optional title override', async () => {
    const fetcher = vi.fn(mockFetcher({
      'POST /api/campaigns/:id/clone': {
        status: 201,
        body: { campaign: { id: 'c2', title: 'Copy of Draft', status: 'draft' } },
      },
    }));
    const client = campaignsApiClient(fetcher);

    const result = await client.cloneCampaign('c1', { title: 'Copy of Draft' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.campaign).toEqual({ id: 'c2', title: 'Copy of Draft', status: 'draft' });
    }
    expect(fetcher).toHaveBeenCalledWith('/api/campaigns/c1/clone', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ title: 'Copy of Draft' }),
    }));
  });

  test('updateCampaign patches PATCH /api/campaigns/:id with title and scheduledAt updates', async () => {
    const fetcher = vi.fn(mockFetcher({
      'PATCH /api/campaigns/:id': {
        status: 200,
        body: {
          campaign: {
            id: 'c1',
            title: 'Updated Draft',
            status: 'draft',
            scheduledAt: '2026-04-10T15:00:00Z',
          },
        },
      },
    }));
    const client = campaignsApiClient(fetcher);

    const result = await client.updateCampaign('c1', {
      title: 'Updated Draft',
      scheduledAt: '2026-04-10T15:00:00Z',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.campaign).toEqual({
        id: 'c1',
        title: 'Updated Draft',
        status: 'draft',
        scheduledAt: '2026-04-10T15:00:00Z',
      });
    }
    expect(fetcher).toHaveBeenCalledWith('/api/campaigns/c1', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({
        title: 'Updated Draft',
        scheduledAt: '2026-04-10T15:00:00Z',
      }),
    }));
  });

  test('addTarget posts to POST /api/campaigns/:id/targets and preserves the created target', async () => {
    const fetcher = vi.fn(mockFetcher({
      'POST /api/campaigns/:id/targets': {
        status: 201,
        body: {
          target: {
            id: 't1',
            campaignId: 'c1',
            channelId: 'ch-1',
            videoTitle: 'Upload Title',
            videoDescription: 'Upload Description',
            tags: ['tag-1'],
            publishAt: '2026-05-01T15:00:00Z',
            playlistId: 'playlist-1',
            privacy: 'unlisted',
            thumbnailAssetId: 'thumb-1',
            status: 'aguardando',
            youtubeVideoId: null,
            errorMessage: null,
            retryCount: 0,
            createdAt: '2026-04-01T00:00:00Z',
            updatedAt: '2026-04-01T00:00:00Z',
          },
        },
      },
    }));
    const client = campaignsApiClient(fetcher);

    const result = await client.addTarget('c1', {
      channelId: 'ch-1',
      videoTitle: 'Upload Title',
      videoDescription: 'Upload Description',
      tags: ['tag-1'],
      publishAt: '2026-05-01T15:00:00Z',
      playlistId: 'playlist-1',
      privacy: 'unlisted',
      thumbnailAssetId: 'thumb-1',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.target).toEqual({
        id: 't1',
        campaignId: 'c1',
        channelId: 'ch-1',
        videoTitle: 'Upload Title',
        videoDescription: 'Upload Description',
        tags: ['tag-1'],
        publishAt: '2026-05-01T15:00:00Z',
        playlistId: 'playlist-1',
        privacy: 'unlisted',
        thumbnailAssetId: 'thumb-1',
        status: 'aguardando',
        youtubeVideoId: null,
        errorMessage: null,
        retryCount: 0,
        createdAt: '2026-04-01T00:00:00Z',
        updatedAt: '2026-04-01T00:00:00Z',
      });
    }
    expect(fetcher).toHaveBeenCalledWith('/api/campaigns/c1/targets', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        channelId: 'ch-1',
        videoTitle: 'Upload Title',
        videoDescription: 'Upload Description',
        tags: ['tag-1'],
        publishAt: '2026-05-01T15:00:00Z',
        playlistId: 'playlist-1',
        privacy: 'unlisted',
        thumbnailAssetId: 'thumb-1',
      }),
    }));
  });

  test('addTargets posts to POST /api/campaigns/:id/targets/bulk and preserves created targets', async () => {
    const fetcher = vi.fn(mockFetcher({
      'POST /api/campaigns/:id/targets/bulk': {
        status: 201,
        body: {
          targets: [
            {
              id: 't1',
              campaignId: 'c1',
              channelId: 'ch-1',
              videoTitle: 'Upload Title 1',
              videoDescription: 'Upload Description 1',
              tags: [],
              publishAt: '2026-05-01T15:00:00Z',
              playlistId: null,
              privacy: 'private',
              thumbnailAssetId: null,
              status: 'aguardando',
              youtubeVideoId: null,
              errorMessage: null,
              retryCount: 0,
              createdAt: '2026-04-01T00:00:00Z',
              updatedAt: '2026-04-01T00:00:00Z',
            },
            {
              id: 't2',
              campaignId: 'c1',
              channelId: 'ch-2',
              videoTitle: 'Upload Title 2',
              videoDescription: 'Upload Description 2',
              tags: ['tag-1'],
              publishAt: null,
              playlistId: 'playlist-1',
              privacy: 'unlisted',
              thumbnailAssetId: 'thumb-1',
              status: 'aguardando',
              youtubeVideoId: null,
              errorMessage: null,
              retryCount: 0,
              createdAt: '2026-04-01T00:00:00Z',
              updatedAt: '2026-04-01T00:00:00Z',
            },
          ],
        },
      },
    }));
    const client = campaignsApiClient(fetcher);

    const result = await client.addTargets('c1', [
      {
        channelId: 'ch-1',
        videoTitle: 'Upload Title 1',
        videoDescription: 'Upload Description 1',
        publishAt: '2026-05-01T15:00:00Z',
      },
      {
        channelId: 'ch-2',
        videoTitle: 'Upload Title 2',
        videoDescription: 'Upload Description 2',
        tags: ['tag-1'],
        playlistId: 'playlist-1',
        privacy: 'unlisted',
        thumbnailAssetId: 'thumb-1',
      },
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.targets).toHaveLength(2);
      expect(result.targets[0].channelId).toBe('ch-1');
      expect(result.targets[1].channelId).toBe('ch-2');
    }
    expect(fetcher).toHaveBeenCalledWith('/api/campaigns/c1/targets/bulk', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        targets: [
          {
            channelId: 'ch-1',
            videoTitle: 'Upload Title 1',
            videoDescription: 'Upload Description 1',
            publishAt: '2026-05-01T15:00:00Z',
          },
          {
            channelId: 'ch-2',
            videoTitle: 'Upload Title 2',
            videoDescription: 'Upload Description 2',
            tags: ['tag-1'],
            playlistId: 'playlist-1',
            privacy: 'unlisted',
            thumbnailAssetId: 'thumb-1',
          },
        ],
      }),
    }));
  });

  test('updateTarget patches PATCH /api/campaigns/:id/targets/:targetId and preserves the updated target', async () => {
    const fetcher = vi.fn(mockFetcher({
      'PATCH /api/campaigns/:id/targets/:targetId': {
        status: 200,
        body: {
          target: {
            id: 't1',
            campaignId: 'c1',
            channelId: 'ch-1',
            videoTitle: 'Updated Title',
            videoDescription: 'Updated Description',
            tags: ['tag-1', 'tag-2'],
            publishAt: '2026-05-02T18:00:00Z',
            playlistId: 'playlist-2',
            privacy: 'public',
            thumbnailAssetId: 'thumb-2',
            status: 'aguardando',
            youtubeVideoId: null,
            errorMessage: null,
            retryCount: 0,
            createdAt: '2026-04-01T00:00:00Z',
            updatedAt: '2026-04-02T00:00:00Z',
          },
        },
      },
    }));
    const client = campaignsApiClient(fetcher);

    const result = await client.updateTarget('c1', 't1', {
      videoTitle: 'Updated Title',
      videoDescription: 'Updated Description',
      tags: ['tag-1', 'tag-2'],
      publishAt: '2026-05-02T18:00:00Z',
      playlistId: 'playlist-2',
      privacy: 'public',
      thumbnailAssetId: 'thumb-2',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.target.videoTitle).toBe('Updated Title');
      expect(result.target.publishAt).toBe('2026-05-02T18:00:00Z');
      expect(result.target.playlistId).toBe('playlist-2');
      expect(result.target.privacy).toBe('public');
      expect(result.target.thumbnailAssetId).toBe('thumb-2');
    }
    expect(fetcher).toHaveBeenCalledWith('/api/campaigns/c1/targets/t1', expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({
        videoTitle: 'Updated Title',
        videoDescription: 'Updated Description',
        tags: ['tag-1', 'tag-2'],
        publishAt: '2026-05-02T18:00:00Z',
        playlistId: 'playlist-2',
        privacy: 'public',
        thumbnailAssetId: 'thumb-2',
      }),
    }));
  });

  test('removeTarget sends DELETE /api/campaigns/:id/targets/:targetId', async () => {
    const fetcher = vi.fn(mockFetcher({
      'DELETE /api/campaigns/:id/targets/:targetId': {
        status: 200,
        body: {},
      },
    }));
    const client = campaignsApiClient(fetcher);

    const result = await client.removeTarget('c1', 't1');

    expect(result.ok).toBe(true);
    expect(fetcher).toHaveBeenCalledWith('/api/campaigns/c1/targets/t1', expect.objectContaining({
      method: 'DELETE',
    }));
  });

  test('deleteCampaign sends DELETE /api/campaigns/:id', async () => {
    const client = campaignsApiClient(mockFetcher({
      'DELETE /api/campaigns/:id': { status: 200, body: {} },
    }));

    const result = await client.deleteCampaign('c1');
    expect(result.ok).toBe(true);
  });

  test('getDashboard fetches GET /api/dashboard', async () => {
    const client = campaignsApiClient(mockFetcher({
      'GET /api/dashboard': {
        status: 200,
        body: {
          campaigns: { total: 5, byStatus: {} },
          targets: { total: 10, byStatus: {}, successRate: 80 },
          jobs: { total: 15, byStatus: {}, totalRetries: 2 },
          channels: [],
        },
      },
    }));

    const result = await client.getDashboard();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.campaigns.total).toBe(5);
  });

  test('handles error responses', async () => {
    const client = campaignsApiClient(mockFetcher({
      'GET /api/campaigns': { status: 500, body: { error: 'Server error' } },
    }));

    const result = await client.listCampaigns();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Server error');
  });

  test('handles rejected network requests without throwing', async () => {
    const fetcher: AuthFetch = vi.fn(() => Promise.reject(new Error('Network down')));
    const client = campaignsApiClient(fetcher);

    const result = await client.getCampaign('c1');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('Network down');
  });

  test('retryTarget posts to POST /api/campaigns/:id/targets/:targetId/retry and preserves the queued job', async () => {
    const client = campaignsApiClient(mockFetcher({
      'POST /api/campaigns/:id/targets/:targetId/retry': {
        status: 200,
        body: {
          job: {
            id: 'j1',
            campaignTargetId: 't1',
            status: 'queued',
            attempt: 2,
            progressPercent: 0,
            youtubeVideoId: null,
            errorMessage: null,
            startedAt: null,
            completedAt: null,
            createdAt: '2026-04-01T00:00:00Z',
          },
        },
      },
    }));

    const result = await client.retryTarget('c1', 't1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.job).toEqual({
        id: 'j1',
        campaignTargetId: 't1',
        status: 'queued',
        attempt: 2,
        progressPercent: 0,
        youtubeVideoId: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
        createdAt: '2026-04-01T00:00:00Z',
      });
    }
  });

  test('getTargetJobs fetches GET /api/campaigns/:id/targets/:targetId/jobs', async () => {
    const client = campaignsApiClient(mockFetcher({
      'GET /api/campaigns/:id/targets/:targetId/jobs': {
        status: 200,
        body: {
          jobs: [
            {
              id: 'j1',
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
        },
      },
    }));

    const result = await client.getTargetJobs('c1', 't1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].status).toBe('failed');
      expect(result.jobs[0].attempt).toBe(1);
    }
  });

  test('getCampaignJobs fetches GET /api/campaigns/:id/jobs', async () => {
    const client = campaignsApiClient(mockFetcher({
      'GET /api/campaigns/:id/jobs': {
        status: 200,
        body: {
          jobsByTarget: {
            t1: [
              {
                id: 'j1',
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
          },
        },
      },
    }));

    const result = await client.getCampaignJobs('c1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.jobsByTarget.t1).toHaveLength(1);
      expect(result.jobsByTarget.t1[0].status).toBe('failed');
    }
  });

  test('getCampaignAudit fetches GET /api/campaigns/:id/audit', async () => {
    const client = campaignsApiClient(mockFetcher({
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
    }));

    const result = await client.getCampaignAudit('c1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.events).toHaveLength(2);
      expect(result.events[0]).toEqual({
        id: 'audit-1',
        eventType: 'publish_partial_failure',
        actorEmail: 'system@internal',
        campaignId: 'c1',
        targetId: 't1',
        createdAt: '2026-04-01T00:03:30Z',
      });
    }
  });

  test('getStatus fetches GET /api/campaigns/:id/status', async () => {
    const client = campaignsApiClient(mockFetcher({
      'GET /api/campaigns/:id/status': {
        status: 200,
        body: {
          campaignId: 'c1',
          campaignStatus: 'launching',
          nextScheduledAt: null,
          targets: [
            {
              targetId: 't1',
              channelId: 'ch-1',
              videoTitle: 'Video',
              status: 'erro',
              youtubeVideoId: 'yt-partial-123',
              errorMessage: 'Video uploaded as yt-partial-123, but adding it to playlist failed: forbidden',
              latestJobStatus: 'failed',
              publishAt: null,
              scheduledPending: false,
              reauthRequired: false,
              hasPostUploadWarning: true,
              reviewYoutubeUrl: 'https://www.youtube.com/watch?v=yt-partial-123',
            },
          ],
          shouldPoll: true,
          progress: { completed: 0, failed: 0, total: 2 },
        },
      },
    }));

    const result = await client.getStatus('c1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.shouldPoll).toBe(true);
      expect(result.data.nextScheduledAt).toBeNull();
      expect(result.data.targets[0].hasPostUploadWarning).toBe(true);
      expect(result.data.targets[0].reviewYoutubeUrl).toBe('https://www.youtube.com/watch?v=yt-partial-123');
      expect(result.data.targets[0].scheduledPending).toBe(false);
      expect(result.data.targets[0].publishAt).toBeNull();
      expect(result.data.targets[0].reauthRequired).toBe(false);
    }
  });

  test('getStatus preserves explicit reauthRequired metadata from the backend', async () => {
    const client = campaignsApiClient(mockFetcher({
      'GET /api/campaigns/:id/status': {
        status: 200,
        body: {
          campaignId: 'c1',
          campaignStatus: 'failed',
          nextScheduledAt: null,
          targets: [
            {
              targetId: 't1',
              channelId: 'ch-1',
              videoTitle: 'Video',
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
          shouldPoll: false,
          progress: { completed: 0, failed: 1, total: 1 },
        },
      },
    }));

    const result = await client.getStatus('c1');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.targets[0].reauthRequired).toBe(true);
      expect(result.data.targets[0].errorMessage).toBe('REAUTH_REQUIRED');
    }
  });
});
