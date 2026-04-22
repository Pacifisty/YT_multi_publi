import { randomUUID } from 'node:crypto';
import { resolve, sep } from 'node:path';

import type { CreateMediaAssetDto, MediaAssetResponseDto } from './dto/create-media-asset.dto';
import { LocalStorageService, type LocalStorageServiceOptions, type UploadedMediaFile } from './storage/local-storage.service';

interface MediaAssetRecord {
  id: string;
  owner_email?: string | null;
  asset_type: 'video' | 'thumbnail';
  original_name: string;
  storage_path: string;
  size_bytes: number;
  mime_type: string;
  duration_seconds: number;
  linked_video_asset_id: string | null;
  created_at: string;
}

export interface MediaAssetFileRecord {
  asset: MediaAssetRecord;
  absolute_path: string;
}

export interface MediaServiceOptions {
  storageRoot?: string;
  now?: () => Date;
  repository?: MediaRepository;
}

export interface MediaRepository {
  create(record: MediaAssetRecord): Promise<MediaAssetRecord>;
  findById(id: string): Promise<MediaAssetRecord | null>;
  findAllNewestFirst(): Promise<MediaAssetRecord[]>;
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

  async findAllNewestFirst(): Promise<MediaAssetRecord[]> {
    return [...this.records].sort((left, right) => (left.created_at < right.created_at ? 1 : -1));
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
  private readonly storageRoot: string;
  private readonly storageRootAbsolute: string;

  constructor(options: MediaServiceOptions = {}, repository?: MediaRepository) {
    this.storageRoot = options.storageRoot ?? process.cwd();
    const storageOptions: LocalStorageServiceOptions = {
      rootDir: this.storageRoot,
    };

    this.storage = new LocalStorageService(storageOptions);
    this.repository = repository ?? options.repository ?? new InMemoryMediaRepository();
    this.now = options.now ?? (() => new Date());
    this.storageRootAbsolute = resolve(this.storageRoot);
  }

  private normalizeOwnerEmail(value: string | null | undefined): string | null {
    const normalized = value?.trim().toLowerCase();
    return normalized ? normalized : null;
  }

  private matchesOwner(asset: Pick<MediaAssetRecord, 'owner_email'>, ownerEmail?: string): boolean {
    const normalizedOwnerEmail = this.normalizeOwnerEmail(ownerEmail);
    if (!normalizedOwnerEmail) {
      return true;
    }

    return this.normalizeOwnerEmail(asset.owner_email) === normalizedOwnerEmail;
  }

  private filterAssetsByOwner(records: MediaAssetRecord[], ownerEmail?: string): MediaAssetRecord[] {
    const normalizedOwnerEmail = this.normalizeOwnerEmail(ownerEmail);
    if (!normalizedOwnerEmail) {
      return records;
    }

    const hasOwnedAssets = records.some((record) => this.normalizeOwnerEmail(record.owner_email) !== null);
    if (!hasOwnedAssets) {
      return records;
    }

    return records.filter((record) => this.matchesOwner(record, ownerEmail));
  }

  async createAsset(dto: CreateMediaAssetDto, ownerEmail?: string): Promise<{ asset: MediaAssetResponseDto }> {
    const nowIso = this.now().toISOString();
    const normalizedOwnerEmail = this.normalizeOwnerEmail(ownerEmail);

    const persistedVideo = await this.storage.save('video', dto.video);
    const videoRecord = await this.repository.create({
      id: randomUUID(),
      owner_email: normalizedOwnerEmail,
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
        owner_email: normalizedOwnerEmail,
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

  async listAssets(ownerEmail?: string): Promise<{ assets: MediaAssetResponseDto[] }> {
    const records = this.filterAssetsByOwner(await this.repository.findAllNewestFirst(), ownerEmail);
    const thumbnailByVideoId = new Map(
      records
        .filter((record) => record.asset_type === 'thumbnail' && record.linked_video_asset_id)
        .map((record) => [record.linked_video_asset_id, record]),
    );

    const assets = records.map((record) => (
      record.asset_type === 'video'
        ? toResponseDto(record, thumbnailByVideoId.get(record.id) ?? undefined)
        : toResponseDto(record)
    ));

    return { assets };
  }

  async getAsset(id: string, ownerEmail?: string): Promise<MediaAssetRecord | null> {
    const asset = await this.repository.findById(id);
    if (!asset) {
      return null;
    }

    if (!this.matchesOwner(asset, ownerEmail)) {
      const hasOwnedAssets = (await this.repository.findAllNewestFirst())
        .some((record) => this.normalizeOwnerEmail(record.owner_email) !== null);
      if (hasOwnedAssets || this.normalizeOwnerEmail(asset.owner_email) !== null) {
        return null;
      }
    }

    return asset;
  }

  async getAssetFile(id: string): Promise<MediaAssetFileRecord | null> {
    const asset = await this.repository.findById(id);
    if (!asset) {
      return null;
    }

    return {
      asset,
      absolute_path: this.resolveStoragePath(asset.storage_path),
    };
  }

  async deleteAsset(id: string, ownerEmail?: string): Promise<boolean> {
    const asset = await this.getAsset(id, ownerEmail);
    if (!asset) {
      return false;
    }

    return this.repository.delete(asset.id);
  }

  async linkThumbnail(thumbnailId: string, videoAssetId: string, ownerEmail?: string): Promise<boolean> {
    const thumbnail = await this.getAsset(thumbnailId, ownerEmail);
    if (!thumbnail) return false;
    const video = await this.getAsset(videoAssetId, ownerEmail);
    if (!video) return false;
    const updated = await this.repository.update(thumbnailId, { linked_video_asset_id: videoAssetId });
    return updated !== null;
  }

  private resolveStoragePath(storagePath: string): string {
    const absolutePath = resolve(this.storageRootAbsolute, storagePath);
    const expectedPrefix = `${this.storageRootAbsolute}${sep}`;

    if (absolutePath !== this.storageRootAbsolute && !absolutePath.startsWith(expectedPrefix)) {
      throw new Error('Media asset storage path escapes the configured storage root.');
    }

    return absolutePath;
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
