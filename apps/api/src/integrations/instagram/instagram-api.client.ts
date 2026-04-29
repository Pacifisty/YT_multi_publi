export interface InstagramReelsContainerParams {
  videoUrl: string;
  caption: string;
  shareToFeed?: boolean;
}

export interface InstagramReelsContainerResponse {
  creation_id: string;
}

export interface InstagramPublishResponse {
  id: string;
}

export interface InstagramPublishStatus {
  status_code: 'IN_PROGRESS' | 'FINISHED' | 'ERROR';
  error_message?: string;
}

export class InstagramApiError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = 'InstagramApiError';
  }
}

export interface InstagramApiClientOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export class InstagramApiClient {
  private readonly baseURL: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(
    private readonly accessToken: string,
    private readonly instagramBusinessAccountId: string,
    baseURL: string = 'https://graph.facebook.com/v19.0',
    options: InstagramApiClientOptions = {},
  ) {
    this.baseURL = baseURL.replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 30_000;
  }

  async createReelsContainer(params: InstagramReelsContainerParams): Promise<InstagramReelsContainerResponse> {
    const body = new URLSearchParams();
    body.set('media_type', 'REELS');
    body.set('video_url', params.videoUrl);
    body.set('caption', params.caption);
    body.set('share_to_feed', String(params.shareToFeed ?? true));
    body.set('access_token', this.accessToken);

    const payload = await this.request(`/${encodeURIComponent(this.instagramBusinessAccountId)}/media`, {
      method: 'POST',
      body,
    });

    return {
      creation_id: readString(payload, 'id') ?? readString(payload, 'creation_id') ?? '',
    };
  }

  async publishReelsContainer(creationId: string): Promise<InstagramPublishResponse> {
    const body = new URLSearchParams();
    body.set('creation_id', creationId);
    body.set('access_token', this.accessToken);

    const payload = await this.request(`/${encodeURIComponent(this.instagramBusinessAccountId)}/media_publish`, {
      method: 'POST',
      body,
    });

    return {
      id: readString(payload, 'id') ?? '',
    };
  }

  async fetchContainerStatus(creationId: string): Promise<InstagramPublishStatus> {
    const path = `/${encodeURIComponent(creationId)}?fields=status_code,error_message&access_token=${encodeURIComponent(this.accessToken)}`;
    const payload = await this.request(path, { method: 'GET' });
    const status = readString(payload, 'status_code');

    return {
      status_code: status === 'FINISHED' || status === 'ERROR' ? status : 'IN_PROGRESS',
      error_message: readString(payload, 'error_message') ?? undefined,
    };
  }

  private async request(path: string, init: RequestInit): Promise<Record<string, unknown>> {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeout = controller
      ? setTimeout(() => controller.abort(), this.timeoutMs)
      : null;

    try {
      const headers = new Headers(init.headers);
      if (init.method === 'POST') {
        headers.set('Content-Type', 'application/x-www-form-urlencoded');
      }

      const response = await this.fetchImpl(`${this.baseURL}${path}`, {
        ...init,
        headers,
        signal: controller?.signal,
      });

      return await readJsonResponse(response);
    } catch (error) {
      if (error instanceof InstagramApiError) {
        throw error;
      }

      const message = error instanceof Error && error.message.trim()
        ? error.message
        : 'Unknown Instagram API error';
      throw new InstagramApiError(500, 'UNKNOWN_ERROR', message);
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

  if (response.ok && !error) {
    return payload ?? {};
  }

  throw new InstagramApiError(
    response.status || 500,
    readString(error, 'code') ?? readString(payload, 'error') ?? 'UNKNOWN_ERROR',
    readString(error, 'message')
      ?? readString(payload, 'message')
      ?? readString(payload, 'error_description')
      ?? 'Instagram API error',
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
