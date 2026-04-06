import { randomUUID } from 'node:crypto';

import type { CreateMediaAssetDto, MediaAssetResponseDto } from './dto/create-media-asset.dto';
import { LocalStorageService, type LocalStorageServiceOptions, type UploadedMediaFile } from './storage/local-storage.service';

interface MediaAssetRecord {
  id: string;
  asset_type: 'video' | 'thumbnail';
  original_name: string;
  storage_path: string;
  size_bytes: number;
  mime_type: string;
  duration_seconds: number;
  linked_video_asset_id: string | null;
  created_at: string;
}

export interface MediaServiceOptions {
  storageRoot?: string;
  now?: () => Date;
  repository?: MediaRepository;
}

export interface MediaRepository {
  create(record: MediaAssetRecord): Promise<MediaAssetRecord>;
  findById(id: string): Promise<MediaAssetRecord | null>;
  findVideosNewestFirst(): Promise<MediaAssetRecord[]>;
  findThumbnailByVideoId(videoAssetId: string): Promise<MediaAssetRecord | null>;
  delete(id: string): Promise<boolean>;
  update(id: string, data: Partial<MediaAssetRecord>): Promise<MediaAssetRecord | null>;
}

export class InMemoryMediaRepository implements MediaRepository {
  private readonly records: MediaAssetRecord[] = [];

  async create(record: MediaAssetRecord): Promise<MediaAssetRecord> {
    this.records.push(record);
    return record;
  }

  async findVideosNewestFirst(): Promise<MediaAssetRecord[]> {
    return this.records
      .filter((record) => record.asset_type === 'video')
      .sort((left, right) => (left.created_at < right.created_at ? 1 : -1));
  }

  async findById(id: string): Promise<MediaAssetRecord | null> {
    return this.records.find((record) => record.id === id) ?? null;
  }

  async findThumbnailByVideoId(videoAssetId: string): Promise<MediaAssetRecord | null> {
    return this.records.find((record) => record.asset_type === 'thumbnail' && record.linked_video_asset_id === videoAssetId) ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const index = this.records.findIndex((record) => record.id === id);
    if (index === -1) return false;
    this.records.splice(index, 1);
    return true;
  }

  async update(id: string, data: Partial<MediaAssetRecord>): Promise<MediaAssetRecord | null> {
    const record = this.records.find((r) => r.id === id);
    if (!record) return null;
    Object.assign(record, data);
    return record;
  }
}

export class MediaService {
  private readonly storage: LocalStorageService;
  private readonly repository: MediaRepository;
  private readonly now: () => Date;

  constructor(options: MediaServiceOptions = {}, repository?: MediaRepository) {
    const storageOptions: LocalStorageServiceOptions = {
      rootDir: options.storageRoot,
    };

    this.storage = new LocalStorageService(storageOptions);
    this.repository = repository ?? options.repository ?? new InMemoryMediaRepository();
    this.now = options.now ?? (() => new Date());
  }

  async createAsset(dto: CreateMediaAssetDto): Promise<{ asset: MediaAssetResponseDto }> {
    const nowIso = this.now().toISOString();

    const persistedVideo = await this.storage.save('video', dto.video);
    const videoRecord = await this.repository.create({
      id: randomUUID(),
      asset_type: 'video',
      original_name: persistedVideo.original_name,
      storage_path: persistedVideo.storage_path,
      size_bytes: persistedVideo.size_bytes,
      mime_type: persistedVideo.mime_type,
      duration_seconds: extractDurationSeconds(dto.video),
      linked_video_asset_id: null,
      created_at: nowIso,
    });

    let thumbnailRecord: MediaAssetRecord | undefined;

    if (dto.thumbnail) {
      const persistedThumbnail = await this.storage.save('thumbnail', dto.thumbnail);

      thumbnailRecord = await this.repository.create({
        id: randomUUID(),
        asset_type: 'thumbnail',
        original_name: persistedThumbnail.original_name,
        storage_path: persistedThumbnail.storage_path,
        size_bytes: persistedThumbnail.size_bytes,
        mime_type: persistedThumbnail.mime_type,
        duration_seconds: 0,
        linked_video_asset_id: videoRecord.id,
        created_at: nowIso,
      });
    }

    return {
      asset: toResponseDto(videoRecord, thumbnailRecord),
    };
  }

  async listAssets(): Promise<{ assets: MediaAssetResponseDto[] }> {
    const videos = await this.repository.findVideosNewestFirst();
    const assets = await Promise.all(
      videos.map(async (video) => {
        const thumbnail = await this.repository.findThumbnailByVideoId(video.id);
        return toResponseDto(video, thumbnail ?? undefined);
      }),
    );

    return { assets };
  }

  async getAsset(id: string): Promise<MediaAssetRecord | null> {
    return this.repository.findById(id);
  }

  async deleteAsset(id: string): Promise<boolean> {
    return this.repository.delete(id);
  }

  async linkThumbnail(thumbnailId: string, videoAssetId: string): Promise<boolean> {
    const thumbnail = await this.repository.findById(thumbnailId);
    if (!thumbnail) return false;
    const video = await this.repository.findById(videoAssetId);
    if (!video) return false;
    const updated = await this.repository.update(thumbnailId, { linked_video_asset_id: videoAssetId });
    return updated !== null;
  }
}

function extractDurationSeconds(file: UploadedMediaFile): number {
  if (typeof file.durationSeconds === 'number' && Number.isFinite(file.durationSeconds) && file.durationSeconds >= 0) {
    return Math.round(file.durationSeconds);
  }

  return 0;
}

function toResponseDto(video: MediaAssetRecord, thumbnail?: MediaAssetRecord): MediaAssetResponseDto {
  return {
    ...video,
    thumbnail: thumbnail
      ? {
          ...thumbnail,
        }
      : undefined,
  };
}
