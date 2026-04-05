import type { UploadContext, UploadResult, YouTubeUploadFn } from '../../campaigns/youtube-upload.worker';

export interface ChannelTokenResolver {
  resolve(channelId: string): Promise<{ accessToken: string }>;
}

export interface VideoFileResolver {
  resolve(videoAssetId: string): Promise<string>;
}

export interface UploadInput {
  channelId: string;
  videoAssetId: string;
  title: string;
  description: string;
  tags: string[];
  privacy: string;
}

export type UploadServiceResult =
  | { ok: true; videoId: string }
  | { ok: false; error: string };

export interface YouTubeUploadServiceOptions {
  uploadFn: YouTubeUploadFn;
  channelTokenResolver: ChannelTokenResolver;
  videoFileResolver: VideoFileResolver;
}

export class YouTubeUploadService {
  private readonly uploadFn: YouTubeUploadFn;
  private readonly channelTokenResolver: ChannelTokenResolver;
  private readonly videoFileResolver: VideoFileResolver;

  constructor(options: YouTubeUploadServiceOptions) {
    this.uploadFn = options.uploadFn;
    this.channelTokenResolver = options.channelTokenResolver;
    this.videoFileResolver = options.videoFileResolver;
  }

  async upload(input: UploadInput): Promise<UploadServiceResult> {
    let accessToken: string;
    try {
      const resolved = await this.channelTokenResolver.resolve(input.channelId);
      accessToken = resolved.accessToken;
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Token resolution failed' };
    }

    let filePath: string;
    try {
      filePath = await this.videoFileResolver.resolve(input.videoAssetId);
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'File resolution failed' };
    }

    try {
      const result = await this.uploadFn({
        accessToken,
        filePath,
        title: input.title,
        description: input.description,
        tags: input.tags,
        privacy: input.privacy,
      });
      return { ok: true, videoId: result.videoId };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Upload failed' };
    }
  }

  async getAccessToken(channelId: string): Promise<string> {
    const resolved = await this.channelTokenResolver.resolve(channelId);
    return resolved.accessToken;
  }

  async getVideoFilePath(videoAssetId: string): Promise<string> {
    return this.videoFileResolver.resolve(videoAssetId);
  }
}
