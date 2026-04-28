import axios, { AxiosInstance } from 'axios';

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

/**
 * TikTok API Client for direct API calls
 */
export class TikTokApiClient {
  private axiosInstance: AxiosInstance;

  constructor(private readonly accessToken: string, baseURL: string = 'https://open.tiktokapis.com/v1') {
    this.axiosInstance = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Query creator info to get available privacy levels and settings
   */
  async queryCreatorInfo(): Promise<TikTokCreatorInfo> {
    try {
      const response = await this.axiosInstance.post<{ data: TikTokCreatorInfo }>(
        '/post/publish/creator_info/query/',
        {},
      );
      return response.data.data || { privacyLevelOptions: ['SELF_ONLY'] };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Initialize video publish (direct post from URL)
   */
  async initPublish(params: TikTokInitPublishParams): Promise<TikTokPublishResponse> {
    try {
      const response = await this.axiosInstance.post<{ data: TikTokPublishResponse }>(
        '/post/publish/video/init/',
        { data: params },
      );
      return response.data.data || { publish_id: '' };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Fetch publish status for a video
   */
  async fetchPublishStatus(publishId: string): Promise<TikTokPublishStatus> {
    try {
      const response = await this.axiosInstance.post<{ data: TikTokPublishStatus }>(
        '/post/publish/status/fetch/',
        { data: { publish_id: publishId } },
      );
      return response.data.data || { status: 'PROCESSING' };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Handle errors and convert to TikTokApiError
   */
  private handleError(error: unknown): TikTokApiError {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status || 500;
      const data = error.response?.data as Record<string, unknown> | undefined;
      const errorCode = (data?.error as string) || 'UNKNOWN_ERROR';
      const message = (data?.message as string) || error.message || 'TikTok API error';
      return new TikTokApiError(status, errorCode, message);
    }

    if (error instanceof Error) {
      return new TikTokApiError(500, 'UNKNOWN_ERROR', error.message);
    }

    return new TikTokApiError(500, 'UNKNOWN_ERROR', 'Unknown TikTok API error');
  }
}
