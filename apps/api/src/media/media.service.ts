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
}

export interface MediaRepository {
  create(record: MediaAssetRecord): MediaAssetRecord;
  findById(id: string): MediaAssetRecord | null;
  findVideosNewestFirst(): MediaAssetRecord[];
  findThumbnailByVideoId(videoAssetId: string): MediaAssetRecord | null;
  delete(id: string): boolean;
  update(id: string, data: Partial<MediaAssetRecord>): MediaAssetRecord | null;
}

export class InMemoryMediaRepository implements MediaRepository {
  private readonly records: MediaAssetRecord[] = [];

  create(record: MediaAssetRecord): MediaAssetRecord {
    this.records.push(record);
    return record;
  }

  findVideosNewestFirst(): MediaAssetRecord[] {
    return this.records
      .filter((record) => record.asset_type === 'video')
      .sort((left, right) => (left.created_at < right.created_at ? 1 : -1));
  }

  findById(id: string): MediaAssetRecord | null {
    return this.records.find((record) => record.id === id) ?? null;
  }

  findThumbnailByVideoId(videoAssetId: string): MediaAssetRecord | null {
    return this.records.find((record) => record.asset_type === 'thumbnail' && record.linked_video_asset_id === videoAssetId) ?? null;
  }

  delete(id: string): boolean {
    const index = this.records.findIndex((record) => record.id === id);
    if (index === -1) return false;
    this.records.splice(index, 1);
    return true;
  }

  update(id: string, data: Partial<MediaAssetRecord>): MediaAssetRecord | null {
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

  constructor(options: MediaServiceOptions = {}, repository: MediaRepository = new InMemoryMediaRepository()) {
    const storageOptions: LocalStorageServiceOptions = {
      rootDir: options.storageRoot,
    };

    this.storage = new LocalStorageService(storageOptions);
    this.repository = repository;
    this.now = options.now ?? (() => new Date());
  }

  async createAsset(dto: CreateMediaAssetDto): Promise<{ asset: MediaAssetResponseDto }> {
    const nowIso = this.now().toISOString();

    const persistedVideo = await this.storage.save('video', dto.video);
    const videoRecord = this.repository.create({
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

      thumbnailRecord = this.repository.create({
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

  listAssets(): { assets: MediaAssetResponseDto[] } {
    const assets = this.repository.findVideosNewestFirst().map((video) =>
      toResponseDto(video, this.repository.findThumbnailByVideoId(video.id) ?? undefined),
    );

    return {
      assets,
    };
  }

  getAsset(id: string): MediaAssetRecord | null {
    return this.repository.findById(id);
  }

  deleteAsset(id: string): boolean {
    return this.repository.delete(id);
  }

  linkThumbnail(thumbnailId: string, videoAssetId: string): boolean {
    const thumbnail = this.repository.findById(thumbnailId);
    if (!thumbnail) return false;
    const video = this.repository.findById(videoAssetId);
    if (!video) return false;
    const updated = this.repository.update(thumbnailId, { linked_video_asset_id: videoAssetId });
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
