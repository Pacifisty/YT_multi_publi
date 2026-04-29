import { describe, expect, test } from 'vitest';

import {
  MockTikTokApiClient,
  MockTikTokApiError,
} from '../../apps/api/src/integrations/tiktok/tiktok.mock-adapter';

const publishParams = {
  source: 'PULL_FROM_URL' as const,
  media_source_url: 'https://media.example.com/video.mp4',
  post_info: {
    title: 'Launch clip',
    privacy_level: 'PUBLIC_TO_EVERYONE',
    disable_comment: false,
    disable_duet: false,
    disable_stitch: false,
  },
};

describe('MockTikTokApiClient', () => {
  test('returns creator info with TikTok privacy levels', async () => {
    const client = new MockTikTokApiClient();

    await expect(client.queryCreatorInfo('valid-token')).resolves.toMatchObject({
      privacyLevelOptions: ['PUBLIC_TO_EVERYONE', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'],
      commentDisabled: false,
      duetDisabled: false,
      stitchDisabled: false,
    });
  });

  test('simulates invalid and revoked tokens', async () => {
    const client = new MockTikTokApiClient();

    await expect(client.queryCreatorInfo('invalid_token')).rejects.toMatchObject({
      statusCode: 401,
      errorCode: '10001',
    });
    await expect(client.initPublish('revoked_token', publishParams)).rejects.toMatchObject({
      statusCode: 401,
      errorCode: 'invalid_grant',
    });
  });

  test('initializes PULL_FROM_URL publishing and completes after configured polling attempts', async () => {
    const client = new MockTikTokApiClient({ pollingAttemptsBeforeSuccess: 2 });

    const init = await client.initPublish('valid-token', publishParams);
    expect(init.publish_id).toMatch(/^mock-tt-/);

    await expect(client.fetchPublishStatus('valid-token', init.publish_id)).resolves.toEqual({
      status: 'PROCESSING',
    });
    await expect(client.fetchPublishStatus('valid-token', init.publish_id)).resolves.toEqual({
      status: 'PROCESSING',
    });
    await expect(client.fetchPublishStatus('valid-token', init.publish_id)).resolves.toMatchObject({
      status: 'PUBLISH_COMPLETE',
      publicly_available_post_id: `post-${init.publish_id}`,
    });
    expect(client.getPublishRecord(init.publish_id)?.params).toEqual(publishParams);
  });

  test('simulates publish failure reasons', async () => {
    const client = new MockTikTokApiClient({
      publishFailureReason: 'Content Policy Violation',
      pollingAttemptsBeforeSuccess: 0,
    });

    const init = await client.initPublish('valid-token', publishParams);

    await expect(client.fetchPublishStatus('valid-token', init.publish_id)).resolves.toEqual({
      status: 'FAILED',
      fail_reason: 'Content Policy Violation',
    });
  });

  test('rejects insecure media URLs', async () => {
    const client = new MockTikTokApiClient();

    await expect(
      client.initPublish('valid-token', {
        ...publishParams,
        media_source_url: 'http://media.example.com/video.mp4',
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
      errorCode: 'invalid_media_url',
    });
  });

  test('simulates 429 rate limiting and can reset internal state', async () => {
    const client = new MockTikTokApiClient({ rateLimitForAttempts: 1 });

    await expect(client.initPublish('valid-token', publishParams)).rejects.toBeInstanceOf(MockTikTokApiError);
    await expect(client.initPublish('valid-token', publishParams)).resolves.toMatchObject({
      publish_id: expect.stringMatching(/^mock-tt-/),
    });
    expect(client.getPublishAttempts()).toBe(2);
    expect(client.getPublishRecords()).toHaveLength(1);

    client.reset();

    expect(client.getPublishAttempts()).toBe(0);
    expect(client.getPublishRecords()).toHaveLength(0);
  });
});
