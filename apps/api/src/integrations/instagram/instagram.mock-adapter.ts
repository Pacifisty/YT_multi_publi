import { randomUUID } from 'node:crypto';
import type {
  InstagramPublishResponse,
  InstagramPublishStatus,
  InstagramReelsContainerParams,
  InstagramReelsContainerResponse,
} from './instagram-api.client';

export interface MockInstagramApiClientBehavior {
  publishFailureReason?: string | null;
  pollingAttemptsBeforeSuccess?: number;
}

export interface MockInstagramContainerRecord {
  creationId: string;
  accessToken: string;
  params: InstagramReelsContainerParams;
}

export class MockInstagramApiError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;

  constructor(statusCode: number, errorCode: string, message: string) {
    super(message);
    this.name = 'MockInstagramApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}

export class MockInstagramApiClient {
  private readonly behavior: MockInstagramApiClientBehavior;
  private readonly statusCallCounts = new Map<string, number>();
  private readonly containerRecords = new Map<string, MockInstagramContainerRecord>();

  constructor(behavior: MockInstagramApiClientBehavior = {}) {
    this.behavior = behavior;
  }

  async createReelsContainer(
    accessToken: string,
    params: InstagramReelsContainerParams,
  ): Promise<InstagramReelsContainerResponse> {
    this.throwForInvalidToken(accessToken);

    if (!params.videoUrl.startsWith('https://')) {
      throw new MockInstagramApiError(400, 'invalid_media_url', 'Instagram media URL must be HTTPS');
    }

    if (!params.caption.trim()) {
      throw new MockInstagramApiError(400, 'missing_caption', 'Instagram caption is required');
    }

    const creationId = `mock-ig-container-${randomUUID()}`;
    this.containerRecords.set(creationId, {
      creationId,
      accessToken,
      params,
    });

    return { creation_id: creationId };
  }

  async publishReelsContainer(accessToken: string, creationId: string): Promise<InstagramPublishResponse> {
    this.throwForInvalidToken(accessToken);

    if (!this.containerRecords.has(creationId)) {
      throw new MockInstagramApiError(404, 'container_not_found', `Container ${creationId} was not initialized`);
    }

    return { id: `ig-post-${creationId}` };
  }

  async fetchContainerStatus(accessToken: string, creationId: string): Promise<InstagramPublishStatus> {
    this.throwForInvalidToken(accessToken);

    if (!this.containerRecords.has(creationId)) {
      throw new MockInstagramApiError(404, 'container_not_found', `Container ${creationId} was not initialized`);
    }

    const previousCallCount = this.statusCallCounts.get(creationId) ?? 0;
    const nextCallCount = previousCallCount + 1;
    this.statusCallCounts.set(creationId, nextCallCount);

    const processingAttempts = this.behavior.pollingAttemptsBeforeSuccess ?? 1;
    if (nextCallCount <= processingAttempts) {
      return { status_code: 'IN_PROGRESS' };
    }

    if (this.behavior.publishFailureReason) {
      return {
        status_code: 'ERROR',
        error_message: this.behavior.publishFailureReason,
      };
    }

    return { status_code: 'FINISHED' };
  }

  getContainerRecord(creationId: string): MockInstagramContainerRecord | null {
    return this.containerRecords.get(creationId) ?? null;
  }

  getContainerRecords(): MockInstagramContainerRecord[] {
    return Array.from(this.containerRecords.values());
  }

  reset(): void {
    this.statusCallCounts.clear();
    this.containerRecords.clear();
  }

  private throwForInvalidToken(accessToken: string): void {
    if (accessToken === 'invalid_token') {
      throw new MockInstagramApiError(401, 'OAuthException', 'Invalid Instagram access token');
    }

    if (accessToken === 'revoked_token') {
      throw new MockInstagramApiError(401, 'invalid_grant', 'Instagram token was revoked');
    }
  }
}
