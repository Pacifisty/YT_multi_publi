import { describe, it, expect, vi, beforeEach } from 'vitest';

import { TikTokApiClient, TikTokApiError } from './tiktok-api.client';

describe('TikTokApiClient', () => {
  let fetchImpl: ReturnType<typeof vi.fn>;
  let client: TikTokApiClient;

  beforeEach(() => {
    fetchImpl = vi.fn();
    client = new TikTokApiClient('test_token_123', 'https://open.tiktokapis.com/v2', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
  });

  it('posts with bearer auth and JSON headers', async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({
      data: {
        privacy_level_options: ['SELF_ONLY'],
      },
    }));

    await client.queryCreatorInfo();

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://open.tiktokapis.com/v2/post/publish/creator_info/query/',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer test_token_123',
          'Content-Type': 'application/json',
        },
        body: '{}',
      }),
    );
  });

  it('accepts a custom base URL without duplicate slashes', async () => {
    fetchImpl.mockResolvedValueOnce(jsonResponse({ data: { privacy_level_options: ['SELF_ONLY'] } }));
    const customClient = new TikTokApiClient('token', 'https://custom.example.com/v2/', {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await customClient.queryCreatorInfo();

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://custom.example.com/v2/post/publish/creator_info/query/',
      expect.any(Object),
    );
  });

  describe('queryCreatorInfo', () => {
    it('returns privacy and interaction settings', async () => {
      fetchImpl.mockResolvedValueOnce(jsonResponse({
        data: {
          privacy_level_options: ['PUBLIC_TO_EVERYONE', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'],
          comment_disabled: true,
          duet_disabled: false,
          stitch_disabled: true,
        },
      }));

      await expect(client.queryCreatorInfo()).resolves.toEqual({
        privacyLevelOptions: ['PUBLIC_TO_EVERYONE', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'],
        commentDisabled: true,
        duetDisabled: false,
        stitchDisabled: true,
      });
    });

    it('returns default privacy levels on empty response', async () => {
      fetchImpl.mockResolvedValueOnce(jsonResponse({ data: {} }));

      await expect(client.queryCreatorInfo()).resolves.toMatchObject({
        privacyLevelOptions: ['SELF_ONLY'],
      });
    });
  });

  describe('initPublish', () => {
    it('initializes publish with URL source', async () => {
      const params = {
        source: 'PULL_FROM_URL' as const,
        media_source_url: 'https://media.r2.com/video.mp4',
        post_info: {
          title: 'Test Video',
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_comment: false,
        },
      };
      fetchImpl.mockResolvedValueOnce(jsonResponse({
        data: {
          publish_id: 'publish-123',
          upload_url: 'https://upload.tiktok.com/video',
        },
      }));

      await expect(client.initPublish(params)).resolves.toEqual({
        publish_id: 'publish-123',
        upload_url: 'https://upload.tiktok.com/video',
      });
      expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ data: params });
    });

    it('returns empty publish_id on null response', async () => {
      fetchImpl.mockResolvedValueOnce(jsonResponse({ data: {} }));

      await expect(client.initPublish({
        source: 'PULL_FROM_URL',
        media_source_url: 'https://media.r2.com/video.mp4',
        post_info: { title: 'Test', privacy_level: 'PUBLIC_TO_EVERYONE' },
      })).resolves.toMatchObject({ publish_id: '' });
    });
  });

  describe('fetchPublishStatus', () => {
    it('fetches publish status', async () => {
      fetchImpl.mockResolvedValueOnce(jsonResponse({
        data: {
          status: 'PUBLISH_COMPLETE',
          publicly_available_post_id: 'post-456',
        },
      }));

      await expect(client.fetchPublishStatus('publish-123')).resolves.toEqual({
        status: 'PUBLISH_COMPLETE',
        publicly_available_post_id: 'post-456',
        fail_reason: undefined,
      });
      expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({
        data: { publish_id: 'publish-123' },
      });
    });

    it('handles failed and processing statuses', async () => {
      fetchImpl
        .mockResolvedValueOnce(jsonResponse({ data: { status: 'FAILED', fail_reason: 'Content policy violation' } }))
        .mockResolvedValueOnce(jsonResponse({ data: { status: 'PROCESSING' } }));

      await expect(client.fetchPublishStatus('publish-123')).resolves.toMatchObject({
        status: 'FAILED',
        fail_reason: 'Content policy violation',
      });
      await expect(client.fetchPublishStatus('publish-123')).resolves.toMatchObject({
        status: 'PROCESSING',
      });
    });
  });

  describe('error handling', () => {
    it('creates TikTokApiError with status and error code', async () => {
      fetchImpl.mockResolvedValueOnce(jsonResponse({
        error: { code: 'RATE_LIMITED', message: 'Too many requests' },
      }, 429));

      await expect(client.queryCreatorInfo()).rejects.toMatchObject({
        statusCode: 429,
        errorCode: 'RATE_LIMITED',
        message: 'Too many requests',
      });
    });

    it('handles network errors', async () => {
      fetchImpl.mockRejectedValueOnce(new Error('Network timeout'));

      await expect(client.queryCreatorInfo()).rejects.toMatchObject({
        statusCode: 500,
        errorCode: 'UNKNOWN_ERROR',
        message: 'Network timeout',
      });
    });

    it('handles unknown error types', async () => {
      fetchImpl.mockRejectedValueOnce('String error');

      await expect(client.queryCreatorInfo()).rejects.toMatchObject({
        statusCode: 500,
        errorCode: 'UNKNOWN_ERROR',
      });
    });
  });
});

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  } as Response;
}
