import { randomUUID } from 'node:crypto';
import type {
  TikTokCreatorInfo,
  TikTokInitPublishParams,
  TikTokPublishResponse,
  TikTokPublishStatus,
} from './tiktok-api.client';

export interface MockTikTokApiClientBehavior {
  publishFailureReason?: string | null;
  pollingAttemptsBeforeSuccess?: number;
  rateLimitAfterAttempts?: number;
  rateLimitForAttempts?: number;
  privacyLevelOptions?: string[];
}

export interface MockTikTokPublishRecord {
  publishId: string;
  accessToken: string;
  params: TikTokInitPublishParams;
}

export class MockTikTokApiError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;

  constructor(statusCode: number, errorCode: string, message: string) {
    super(message);
    this.name = 'MockTikTokApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export class MockTikTokApiClient {
  private readonly behavior: MockTikTokApiClientBehavior;
  private readonly statusCallCounts = new Map<string, number>();
  private readonly publishRecords = new Map<string, MockTikTokPublishRecord>();
  private publishAttemptCount = 0;

  constructor(behavior: MockTikTokApiClientBehavior = {}) {
    this.behavior = behavior;
  }

  async queryCreatorInfo(accessToken: string): Promise<TikTokCreatorInfo> {
    this.throwForInvalidToken(accessToken);

    return {
      privacyLevelOptions: this.behavior.privacyLevelOptions ?? [
        'PUBLIC_TO_EVERYONE',
        'FOLLOWER_OF_CREATOR',
        'SELF_ONLY',
      ],
      commentDisabled: false,
      duetDisabled: false,
      stitchDisabled: false,
    };
  }

  async initPublish(accessToken: string, params: TikTokInitPublishParams): Promise<TikTokPublishResponse> {
    this.publishAttemptCount += 1;
    this.throwForInvalidToken(accessToken);

    if (this.shouldRateLimitCurrentAttempt()) {
      throw new MockTikTokApiError(429, 'rate_limit_exceeded', 'TikTok rate limit exceeded');
    }

    if (params.source !== 'PULL_FROM_URL') {
      throw new MockTikTokApiError(400, 'invalid_source', 'Mock TikTok only supports PULL_FROM_URL');
    }

    if (!params.media_source_url.startsWith('https://')) {
      throw new MockTikTokApiError(400, 'invalid_media_url', 'TikTok media URL must be HTTPS');
    }

    const publishId = `mock-tt-${randomUUID()}`;
    this.publishRecords.set(publishId, {
      publishId,
      accessToken,
      params,
    });

    return { publish_id: publishId };
  }

  async fetchPublishStatus(accessToken: string, publishId: string): Promise<TikTokPublishStatus> {
    this.throwForInvalidToken(accessToken);

    if (!this.publishRecords.has(publishId)) {
      throw new MockTikTokApiError(404, 'publish_not_found', `Publish ${publishId} was not initialized`);
    }

    const previousCallCount = this.statusCallCounts.get(publishId) ?? 0;
    const nextCallCount = previousCallCount + 1;
    this.statusCallCounts.set(publishId, nextCallCount);

    const processingAttempts = this.behavior.pollingAttemptsBeforeSuccess ?? 1;
    if (nextCallCount <= processingAttempts) {
      return { status: 'PROCESSING' };
    }

    if (this.behavior.publishFailureReason) {
      return {
        status: 'FAILED',
        fail_reason: this.behavior.publishFailureReason,
      };
    }

    return {
      status: 'PUBLISH_COMPLETE',
      publicly_available_post_id: `post-${publishId}`,
    };
  }

  getPublishAttempts(): number {
    return this.publishAttemptCount;
  }

  getPublishRecord(publishId: string): MockTikTokPublishRecord | null {
    return this.publishRecords.get(publishId) ?? null;
  }

  getPublishRecords(): MockTikTokPublishRecord[] {
    return Array.from(this.publishRecords.values());
  }

  reset(): void {
    this.statusCallCounts.clear();
    this.publishRecords.clear();
    this.publishAttemptCount = 0;
  }

  private shouldRateLimitCurrentAttempt(): boolean {
    if (
      this.behavior.rateLimitForAttempts !== undefined &&
      this.publishAttemptCount <= this.behavior.rateLimitForAttempts
    ) {
      return true;
    }

    return this.behavior.rateLimitAfterAttempts !== undefined &&
      this.publishAttemptCount > this.behavior.rateLimitAfterAttempts;
  }

  private throwForInvalidToken(accessToken: string): void {
    if (accessToken === 'invalid_token') {
      throw new MockTikTokApiError(401, '10001', 'Invalid TikTok access token');
    }

    if (accessToken === 'revoked_token') {
      throw new MockTikTokApiError(401, 'invalid_grant', 'TikTok refresh token was revoked');
    }
  }
}
