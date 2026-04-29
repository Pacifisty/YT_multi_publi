import { describe, expect, test, vi } from 'vitest';

import { TikTokApiClient } from '../../apps/api/src/integrations/tiktok/tiktok-api.client';

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}

describe('TikTokApiClient fetch implementation', () => {
  test('queries creator info with bearer auth and default privacy fallback', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ data: {} }));
    const client = new TikTokApiClient('tt-token', 'https://open.tiktokapis.com/v2/', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const info = await client.queryCreatorInfo();

    expect(info.privacyLevelOptions).toEqual(['SELF_ONLY']);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://open.tiktokapis.com/v2/post/publish/creator_info/query/',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer tt-token',
          'Content-Type': 'application/json',
        },
        body: '{}',
      }),
    );
  });

  test('initializes PULL_FROM_URL publishing and fetches completion status', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ data: { publish_id: 'pub-123' } }))
      .mockResolvedValueOnce(jsonResponse({
        data: {
          status: 'PUBLISH_COMPLETE',
          publicly_available_post_id: 'post-123',
        },
      }));
    const client = new TikTokApiClient('tt-token', 'https://open.tiktokapis.com/v2', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const init = await client.initPublish({
      source: 'PULL_FROM_URL',
      media_source_url: 'https://media.example.com/video.mp4',
      post_info: {
        title: 'Launch',
        privacy_level: 'SELF_ONLY',
      },
    });
    const status = await client.fetchPublishStatus(init.publish_id);

    expect(init).toEqual({ publish_id: 'pub-123', upload_url: undefined });
    expect(status).toMatchObject({
      status: 'PUBLISH_COMPLETE',
      publicly_available_post_id: 'post-123',
    });
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({
      data: {
        source: 'PULL_FROM_URL',
        media_source_url: 'https://media.example.com/video.mp4',
      },
    });
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({
      data: { publish_id: 'pub-123' },
    });
  });

  test('maps TikTok API and network errors to TikTokApiError shape', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        error: { code: 'rate_limit_exceeded', message: 'Too many requests' },
      }, 429))
      .mockRejectedValueOnce(new Error('Network timeout'));
    const client = new TikTokApiClient('tt-token', 'https://open.tiktokapis.com/v2', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(client.queryCreatorInfo()).rejects.toMatchObject({
      name: 'TikTokApiError',
      statusCode: 429,
      errorCode: 'rate_limit_exceeded',
      message: 'Too many requests',
    });
    await expect(client.queryCreatorInfo()).rejects.toMatchObject({
      name: 'TikTokApiError',
      statusCode: 500,
      errorCode: 'UNKNOWN_ERROR',
      message: 'Network timeout',
    });
  });
});
