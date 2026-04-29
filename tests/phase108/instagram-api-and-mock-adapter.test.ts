import { describe, it, expect, vi } from 'vitest';
import {
  InstagramApiClient,
  InstagramApiError,
} from '../../apps/api/src/integrations/instagram/instagram-api.client';
import {
  MockInstagramApiClient,
  MockInstagramApiError,
} from '../../apps/api/src/integrations/instagram/instagram.mock-adapter';

describe('Phase 108 - Instagram API client and mock adapter', () => {
  it('creates Reels containers, publishes them, and polls status through Graph API', async () => {
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = String(url);

      if (href === 'https://graph.example/ig-business-1/media') {
        expect(init?.method).toBe('POST');
        const body = init?.body as URLSearchParams;
        expect(body.get('media_type')).toBe('REELS');
        expect(body.get('video_url')).toBe('https://cdn.example.com/reel.mp4');
        expect(body.get('caption')).toBe('Launch caption');
        expect(body.get('share_to_feed')).toBe('false');
        expect(body.get('access_token')).toBe('ig-access-token');
        return jsonResponse({ id: 'container-123' });
      }

      if (href === 'https://graph.example/ig-business-1/media_publish') {
        expect(init?.method).toBe('POST');
        const body = init?.body as URLSearchParams;
        expect(body.get('creation_id')).toBe('container-123');
        return jsonResponse({ id: 'post-123' });
      }

      if (href.startsWith('https://graph.example/container-123?')) {
        expect(init?.method).toBe('GET');
        return jsonResponse({ status_code: 'FINISHED' });
      }

      throw new Error(`Unexpected request: ${href}`);
    }) as unknown as typeof fetch;

    const client = new InstagramApiClient(
      'ig-access-token',
      'ig-business-1',
      'https://graph.example',
      { fetchImpl },
    );

    await expect(client.createReelsContainer({
      videoUrl: 'https://cdn.example.com/reel.mp4',
      caption: 'Launch caption',
      shareToFeed: false,
    })).resolves.toEqual({ creation_id: 'container-123' });
    await expect(client.publishReelsContainer('container-123')).resolves.toEqual({ id: 'post-123' });
    await expect(client.fetchContainerStatus('container-123')).resolves.toEqual({ status_code: 'FINISHED' });
  });

  it('maps Graph API error payloads into InstagramApiError', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({
      error: {
        code: 'OAuthException',
        message: 'Invalid OAuth access token.',
      },
    }, 401)) as unknown as typeof fetch;
    const client = new InstagramApiClient('bad-token', 'ig-business-1', 'https://graph.example', { fetchImpl });

    await expect(client.publishReelsContainer('container-123')).rejects.toMatchObject({
      name: 'InstagramApiError',
      statusCode: 401,
      errorCode: 'OAuthException',
      message: 'Invalid OAuth access token.',
    } satisfies Partial<InstagramApiError>);
  });

  it('simulates Instagram Reels publishing success and failure states', async () => {
    const mock = new MockInstagramApiClient({ pollingAttemptsBeforeSuccess: 1 });
    const created = await mock.createReelsContainer('valid-token', {
      videoUrl: 'https://cdn.example.com/reel.mp4',
      caption: 'Caption',
      shareToFeed: true,
    });

    expect(mock.getContainerRecord(created.creation_id)?.params.caption).toBe('Caption');
    await expect(mock.fetchContainerStatus('valid-token', created.creation_id)).resolves.toEqual({
      status_code: 'IN_PROGRESS',
    });
    await expect(mock.fetchContainerStatus('valid-token', created.creation_id)).resolves.toEqual({
      status_code: 'FINISHED',
    });
    await expect(mock.publishReelsContainer('valid-token', created.creation_id)).resolves.toEqual({
      id: `ig-post-${created.creation_id}`,
    });

    await expect(
      mock.createReelsContainer('valid-token', {
        videoUrl: 'http://cdn.example.com/reel.mp4',
        caption: 'Caption',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      errorCode: 'invalid_media_url',
    } satisfies Partial<MockInstagramApiError>);

    await expect(
      mock.createReelsContainer('invalid_token', {
        videoUrl: 'https://cdn.example.com/reel.mp4',
        caption: 'Caption',
      }),
    ).rejects.toMatchObject({
      statusCode: 401,
      errorCode: 'OAuthException',
    } satisfies Partial<MockInstagramApiError>);
  });

  it('returns configured mock publish errors after processing attempts', async () => {
    const mock = new MockInstagramApiClient({
      pollingAttemptsBeforeSuccess: 0,
      publishFailureReason: 'Media processing failed',
    });
    const created = await mock.createReelsContainer('valid-token', {
      videoUrl: 'https://cdn.example.com/reel.mp4',
      caption: 'Caption',
    });

    await expect(mock.fetchContainerStatus('valid-token', created.creation_id)).resolves.toEqual({
      status_code: 'ERROR',
      error_message: 'Media processing failed',
    });
  });
});

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
