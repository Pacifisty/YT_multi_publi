import type { UploadContext, UploadResult, YouTubeUploadFn } from '../../campaigns/youtube-upload.worker';
import {
  isChannelTokenResolverError,
  type ChannelTokenResolverErrorCode,
  type ChannelTokenResolutionOptions,
  type ChannelTokenResolver,
} from './channel-token-resolver';
export type { ChannelTokenResolver, ChannelTokenResolutionOptions } from './channel-token-resolver';

export interface VideoFileResolver {
  resolve(videoAssetId: string): Promise<string>;
}

export interface ThumbnailFileResolver {
  resolve(thumbnailAssetId: string): Promise<string>;
}

export interface UploadInput {
  channelId: string;
  videoAssetId: string;
  title: string;
  description: string;
  tags: string[];
  playlistId?: string;
  thumbnailAssetId?: string;
  privacy: string;
}

export type UploadServiceResult =
  | { ok: true; videoId: string }
  | { ok: false; error: string; code?: ChannelTokenResolverErrorCode };

export interface YouTubeUploadServiceOptions {
  uploadFn: YouTubeUploadFn;
  channelTokenResolver: ChannelTokenResolver;
  videoFileResolver: VideoFileResolver;
  thumbnailFileResolver?: ThumbnailFileResolver;
}

export class YouTubeUploadService {
  private readonly uploadFn: YouTubeUploadFn;
  private readonly channelTokenResolver: ChannelTokenResolver;
  private readonly videoFileResolver: VideoFileResolver;
  private readonly thumbnailFileResolver?: ThumbnailFileResolver;

  constructor(options: YouTubeUploadServiceOptions) {
    this.uploadFn = options.uploadFn;
    this.channelTokenResolver = options.channelTokenResolver;
    this.videoFileResolver = options.videoFileResolver;
    this.thumbnailFileResolver = options.thumbnailFileResolver;
  }

  async upload(input: UploadInput): Promise<UploadServiceResult> {
    let accessToken: string;
    try {
      const resolved = input.playlistId
        ? await this.channelTokenResolver.resolve(input.channelId, { requirePlaylistWriteScope: true })
        : await this.channelTokenResolver.resolve(input.channelId);
      accessToken = resolved.accessToken;
    } catch (error) {
      return { ok: false, ...this.normalizeTokenResolutionError(error) };
    }

    let filePath: string;
    try {
      filePath = await this.videoFileResolver.resolve(input.videoAssetId);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'File resolution failed' };
    }

    let thumbnailFilePath: string | null = null;
    if (input.thumbnailAssetId) {
      if (!this.thumbnailFileResolver) {
        return { ok: false, error: 'Thumbnail resolution not configured' };
      }

      try {
        thumbnailFilePath = await this.thumbnailFileResolver.resolve(input.thumbnailAssetId);
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Thumbnail resolution failed' };
      }
    }

    try {
      const result = await this.uploadFn({
        accessToken,
        filePath,
        thumbnailFilePath,
        title: input.title,
        description: input.description,
        tags: input.tags,
        playlistId: input.playlistId ?? null,
        privacy: input.privacy,
      });
      return { ok: true, videoId: result.videoId };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Upload failed' };
    }
  }

  async getAccessToken(channelId: string, options?: ChannelTokenResolutionOptions): Promise<string> {
    const resolved = options
      ? await this.channelTokenResolver.resolve(channelId, options)
      : await this.channelTokenResolver.resolve(channelId);
    return resolved.accessToken;
  }

  async getVideoFilePath(videoAssetId: string): Promise<string> {
    return this.videoFileResolver.resolve(videoAssetId);
  }

  private normalizeTokenResolutionError(error: unknown): {
    error: string;
    code?: ChannelTokenResolverErrorCode;
  } {
    if (isChannelTokenResolverError(error)) {
      return {
        error: error.code === 'REAUTH_REQUIRED' ? 'REAUTH_REQUIRED' : error.message,
        code: error.code,
      };
    }

    return {
      error: error instanceof Error ? error.message : 'Token resolution failed',
    };
  }
}
