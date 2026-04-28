import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { TikTokApiClient, TikTokApiError } from './tiktok-api.client';

vi.mock('axios');

describe('TikTokApiClient', () => {
  let client: TikTokApiClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      post: vi.fn(),
    };
    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance);
    client = new TikTokApiClient('test_token_123');
  });

  describe('constructor', () => {
    it('should create axios instance with correct config', () => {
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://open.tiktokapis.com/v1',
        timeout: 30000,
        headers: {
          Authorization: 'Bearer test_token_123',
          'Content-Type': 'application/json',
        },
      });
    });

    it('should accept custom baseURL', () => {
      vi.mocked(axios.create).mockClear();
      new TikTokApiClient('token', 'https://custom.com/v2');
      const call = vi.mocked(axios.create).mock.calls[0][0];
      expect(call.baseURL).toBe('https://custom.com/v2');
    });
  });

  describe('queryCreatorInfo', () => {
    it('should query creator info and return privacy levels', async () => {
      const mockResponse = {
        data: {
          privacyLevelOptions: ['PUBLIC_TO_EVERYONE', 'FOLLOWER_OF_CREATOR', 'SELF_ONLY'],
        },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.queryCreatorInfo();

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/post/publish/creator_info/query/', {});
      expect(result.privacyLevelOptions).toEqual([
        'PUBLIC_TO_EVERYONE',
        'FOLLOWER_OF_CREATOR',
        'SELF_ONLY',
      ]);
    });

    it('should return default privacy levels on empty response', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: {} });

      const result = await client.queryCreatorInfo();

      expect(result.privacyLevelOptions).toEqual(['SELF_ONLY']);
    });

    it('should throw TikTokApiError on failure', async () => {
      const error = new Error('API Error');
      (error as any).response = {
        status: 401,
        data: { error: 'INVALID_TOKEN', message: 'Token expired' },
      };
      mockAxiosInstance.post.mockRejectedValue(error);

      await expect(client.queryCreatorInfo()).rejects.toThrow(TikTokApiError);
    });
  });

  describe('initPublish', () => {
    it('should initialize publish with URL source', async () => {
      const params = {
        source: 'PULL_FROM_URL' as const,
        media_source_url: 'https://media.r2.com/video.mp4',
        post_info: {
          title: 'Test Video',
          privacy_level: 'PUBLIC_TO_EVERYONE',
          disable_comment: false,
        },
      };
      const mockResponse = {
        data: {
          publish_id: 'publish-123',
          upload_url: 'https://upload.tiktok.com/video',
        },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.initPublish(params);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/post/publish/video/init/', {
        data: params,
      });
      expect(result.publish_id).toBe('publish-123');
      expect(result.upload_url).toBe('https://upload.tiktok.com/video');
    });

    it('should return empty publish_id on null response', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: {} });

      const result = await client.initPublish({
        source: 'PULL_FROM_URL',
        media_source_url: 'https://media.r2.com/video.mp4',
        post_info: { title: 'Test', privacy_level: 'PUBLIC_TO_EVERYONE' },
      });

      expect(result.publish_id).toBe('');
    });
  });

  describe('fetchPublishStatus', () => {
    it('should fetch publish status', async () => {
      const mockResponse = {
        data: {
          status: 'PUBLISH_COMPLETE',
          publicly_available_post_id: 'post-456',
        },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.fetchPublishStatus('publish-123');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/post/publish/status/fetch/', {
        data: { publish_id: 'publish-123' },
      });
      expect(result.status).toBe('PUBLISH_COMPLETE');
      expect(result.publicly_available_post_id).toBe('post-456');
    });

    it('should handle FAILED status with fail reason', async () => {
      const mockResponse = {
        data: {
          status: 'FAILED',
          fail_reason: 'Content policy violation',
        },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.fetchPublishStatus('publish-123');

      expect(result.status).toBe('FAILED');
      expect(result.fail_reason).toBe('Content policy violation');
    });

    it('should handle PROCESSING status', async () => {
      const mockResponse = {
        data: {
          status: 'PROCESSING',
        },
      };
      mockAxiosInstance.post.mockResolvedValue(mockResponse);

      const result = await client.fetchPublishStatus('publish-123');

      expect(result.status).toBe('PROCESSING');
    });
  });

  describe('error handling', () => {
    it('should create TikTokApiError with status and error code', async () => {
      const error = new Error('API Error');
      (error as any).response = {
        status: 429,
        data: { error: 'RATE_LIMITED', message: 'Too many requests' },
      };
      mockAxiosInstance.post.mockRejectedValue(error);

      const thrown = await expect(client.queryCreatorInfo()).rejects.toThrow(TikTokApiError);
      await thrown.then((err) => {
        expect(err.statusCode).toBe(429);
        expect(err.errorCode).toBe('RATE_LIMITED');
        expect(err.message).toBe('Too many requests');
      });
    });

    it('should handle non-axios errors', async () => {
      const error = new Error('Network timeout');
      mockAxiosInstance.post.mockRejectedValue(error);

      const thrown = await expect(client.queryCreatorInfo()).rejects.toThrow(TikTokApiError);
      await thrown.then((err) => {
        expect(err.statusCode).toBe(500);
        expect(err.errorCode).toBe('UNKNOWN_ERROR');
      });
    });

    it('should handle unknown error types', async () => {
      mockAxiosInstance.post.mockRejectedValue('String error');

      const thrown = await expect(client.queryCreatorInfo()).rejects.toThrow(TikTokApiError);
      await thrown.then((err) => {
        expect(err.statusCode).toBe(500);
        expect(err.errorCode).toBe('UNKNOWN_ERROR');
      });
    });
  });
});
