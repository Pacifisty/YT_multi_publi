/**
 * TikTok Creator Info Response
 */
export interface TikTokCreatorInfo {
  privacyLevelOptions: string[];
  commentDisabled?: boolean;
  duetDisabled?: boolean;
  stitchDisabled?: boolean;
}

/**
 * TikTok Publish Initialization Request
 */
export interface TikTokInitPublishParams {
  source: 'PULL_FROM_URL';
  media_source_url: string;
  post_info: {
    title: string;
    privacy_level: string;
    disable_comment?: boolean;
    disable_duet?: boolean;
    disable_stitch?: boolean;
  };
}

/**
 * TikTok Publish Initialization Response
 */
export interface TikTokPublishResponse {
  publish_id: string;
  upload_url?: string;
}

/**
 * TikTok Publish Status Response
 */
export interface TikTokPublishStatus {
  status: 'PROCESSING' | 'PUBLISH_COMPLETE' | 'FAILED';
  publicly_available_post_id?: string;
  fail_reason?: string;
}

/**
 * TikTok API Error
 */
export class TikTokApiError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = 'TikTokApiError';
  }
}

export interface TikTokApiClientOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * TikTok API Client for direct API calls.
 */
export class TikTokApiClient {
  private readonly baseURL: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(
    private readonly accessToken: string,
    baseURL: string = 'https://open.tiktokapis.com/v2',
    options: TikTokApiClientOptions = {},
  ) {
    this.baseURL = baseURL.replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  /**
   * Query creator info to get available privacy levels and settings.
   */
  async queryCreatorInfo(): Promise<TikTokCreatorInfo> {
    const payload = await this.post('/post/publish/creator_info/query/', {});
    const data = readObject(payload, 'data') ?? payload;

    return {
      privacyLevelOptions: readStringArray(data, 'privacyLevelOptions')
        ?? readStringArray(data, 'privacy_level_options')
        ?? ['SELF_ONLY'],
      commentDisabled: readBoolean(data, 'commentDisabled') ?? readBoolean(data, 'comment_disabled') ?? false,
      duetDisabled: readBoolean(data, 'duetDisabled') ?? readBoolean(data, 'duet_disabled') ?? false,
      stitchDisabled: readBoolean(data, 'stitchDisabled') ?? readBoolean(data, 'stitch_disabled') ?? false,
    };
  }

  /**
   * Initialize video publish (direct post from URL).
   */
  async initPublish(params: TikTokInitPublishParams): Promise<TikTokPublishResponse> {
    const payload = await this.post('/post/publish/video/init/', { data: params });
    const data = readObject(payload, 'data') ?? payload;

    return {
      publish_id: readString(data, 'publish_id') ?? '',
      upload_url: readString(data, 'upload_url') ?? undefined,
    };
  }

  /**
   * Fetch publish status for a video.
   */
  async fetchPublishStatus(publishId: string): Promise<TikTokPublishStatus> {
    const payload = await this.post('/post/publish/status/fetch/', {
      data: { publish_id: publishId },
    });
    const data = readObject(payload, 'data') ?? payload;
    const status = readString(data, 'status');

    return {
      status: status === 'PUBLISH_COMPLETE' || status === 'FAILED' ? status : 'PROCESSING',
      publicly_available_post_id: readString(data, 'publicly_available_post_id') ?? undefined,
      fail_reason: readString(data, 'fail_reason') ?? undefined,
    };
  }

  private async post(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = controller
      ? setTimeout(() => controller.abort(), this.timeoutMs)
      : null;

    try {
      const response = await this.fetchImpl(`${this.baseURL}${path}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller?.signal,
      });

      return await readJsonResponse(response);
    } catch (error) {
      if (error instanceof TikTokApiError) {
        throw error;
      }

      const message = error instanceof Error && error.message.trim()
        ? error.message
        : 'Unknown TikTok API error';
      throw new TikTokApiError(500, 'UNKNOWN_ERROR', message);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }
}

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  const error = readObject(payload, 'error');
  const errorCode = readString(error, 'code') ?? readString(payload, 'error');

  if (response.ok && (!errorCode || errorCode === 'ok')) {
    return payload ?? {};
  }

  throw new TikTokApiError(
    response.status || 500,
    errorCode ?? 'UNKNOWN_ERROR',
    readString(error, 'message')
      ?? readString(payload, 'message')
      ?? readString(payload, 'error_description')
      ?? 'TikTok API error',
  );
}

function readObject(value: Record<string, unknown> | null | undefined, key: string): Record<string, unknown> | null {
  const raw = value?.[key];
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : null;
}

function readString(value: Record<string, unknown> | null | undefined, key: string): string | null {
  const raw = value?.[key];
  return typeof raw === 'string' && raw.trim() ? raw : null;
}

function readBoolean(value: Record<string, unknown> | null | undefined, key: string): boolean | null {
  const raw = value?.[key];
  return typeof raw === 'boolean' ? raw : null;
}

function readStringArray(value: Record<string, unknown> | null | undefined, key: string): string[] | null {
  const raw = value?.[key];
  if (!Array.isArray(raw)) {
    return null;
  }

  return raw.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}
