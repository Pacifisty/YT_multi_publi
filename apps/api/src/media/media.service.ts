import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

import type { CreateMediaAssetDto, MediaAssetResponseDto } from './dto/create-media-asset.dto';
import { LocalStorageService, type LocalStorageServiceOptions, type UploadedMediaFile } from './storage/local-storage.service';
import type { MediaStorageService } from './storage/media-storage.service';

interface MediaAssetRecord {
  id: string;
  owner_email?: string | null;
  asset_type: 'video' | 'thumbnail';
  original_name: string;
  storage_path: string;
  source_path?: string | null;
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
  storage?: MediaStorageService;
  now?: () => Date;
  repository?: MediaRepository;
  orphanCleanupEnabled?: boolean;
  orphanGracePeriodMs?: number;
  orphanCleanupIntervalMs?: number;
}

export interface OrphanCleanupResult {
  scanned: number;
  deleted: number;
  retained: number;
  failed: number;
  skipped: boolean;
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
  private readonly storage: MediaStorageService;
  private readonly repository: MediaRepository;
  private readonly now: () => Date;
  private readonly storageRoot: string;
  private readonly orphanCleanupEnabled: boolean;
  private readonly orphanGracePeriodMs: number;
  private readonly orphanCleanupIntervalMs: number;
  private lastOrphanCleanupAtMs = 0;
  private orphanCleanupPromise: Promise<OrphanCleanupResult> | null = null;

  constructor(options: MediaServiceOptions = {}, repository?: MediaRepository) {
    this.storageRoot = options.storageRoot ?? process.cwd();
    const storageOptions: LocalStorageServiceOptions = {
      rootDir: this.storageRoot,
    };

    this.storage = options.storage ?? new LocalStorageService(storageOptions);
    this.repository = repository ?? options.repository ?? new InMemoryMediaRepository();
    this.now = options.now ?? (() => new Date());
    this.orphanCleanupEnabled = options.orphanCleanupEnabled ?? false;
    this.orphanGracePeriodMs = Math.max(0, options.orphanGracePeriodMs ?? 60_000);
    this.orphanCleanupIntervalMs = Math.max(0, options.orphanCleanupIntervalMs ?? 60_000);
  }

  getStorageProviderName(): MediaStorageService['providerName'] {
    return this.storage.providerName;
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

    return records.filter((record) => this.matchesOwner(record, ownerEmail));
  }

  async createAsset(dto: CreateMediaAssetDto, ownerEmail?: string): Promise<{ asset: MediaAssetResponseDto }> {
    const nowIso = this.now().toISOString();
    const normalizedOwnerEmail = this.normalizeOwnerEmail(ownerEmail);

    const persistedVideo = await this.storage.save('video', dto.video);
    let videoRecord: MediaAssetRecord;
    try {
      videoRecord = await this.repository.create({
        id: randomUUID(),
        owner_email: normalizedOwnerEmail,
        asset_type: 'video',
        original_name: persistedVideo.original_name,
        storage_path: persistedVideo.storage_path,
        source_path: dto.video.keepSource && dto.video.filePath ? resolve(dto.video.filePath) : null,
        size_bytes: persistedVideo.size_bytes,
        mime_type: persistedVideo.mime_type,
        duration_seconds: extractDurationSeconds(dto.video),
        linked_video_asset_id: null,
        created_at: nowIso,
      });
    } catch (error) {
      await this.deletePersistedFile(persistedVideo.storage_path);
      throw error;
    }

    let thumbnailRecord: MediaAssetRecord | undefined;

    if (dto.thumbnail) {
      const persistedThumbnail = await this.storage.save('thumbnail', dto.thumbnail);

      try {
        thumbnailRecord = await this.repository.create({
          id: randomUUID(),
          owner_email: normalizedOwnerEmail,
          asset_type: 'thumbnail',
          original_name: persistedThumbnail.original_name,
          storage_path: persistedThumbnail.storage_path,
          source_path: dto.thumbnail.keepSource && dto.thumbnail.filePath ? resolve(dto.thumbnail.filePath) : null,
          size_bytes: persistedThumbnail.size_bytes,
          mime_type: persistedThumbnail.mime_type,
          duration_seconds: 0,
          linked_video_asset_id: videoRecord.id,
          created_at: nowIso,
        });
      } catch (error) {
        await this.deletePersistedFile(persistedThumbnail.storage_path);
        throw error;
      }
      if (thumbnailRecord.linked_video_asset_id !== videoRecord.id) {
        thumbnailRecord = await this.repository.update(thumbnailRecord.id, {
          linked_video_asset_id: videoRecord.id,
        }) ?? thumbnailRecord;
      }
    }

    return {
      asset: toResponseDto(videoRecord, thumbnailRecord),
    };
  }

  async createThumbnailForVideo(
    videoAssetId: string,
    thumbnail: UploadedMediaFile,
    ownerEmail?: string,
  ): Promise<MediaAssetResponseDto | null> {
    const video = await this.getAsset(videoAssetId, ownerEmail);
    if (!video || video.asset_type !== 'video') {
      return null;
    }

    const persistedThumbnail = await this.storage.save('thumbnail', thumbnail);
    let thumbnailRecord: MediaAssetRecord;
    try {
      thumbnailRecord = await this.repository.create({
        id: randomUUID(),
        owner_email: this.normalizeOwnerEmail(ownerEmail),
        asset_type: 'thumbnail',
        original_name: persistedThumbnail.original_name,
        storage_path: persistedThumbnail.storage_path,
        source_path: thumbnail.keepSource && thumbnail.filePath ? resolve(thumbnail.filePath) : null,
        size_bytes: persistedThumbnail.size_bytes,
        mime_type: persistedThumbnail.mime_type,
        duration_seconds: 0,
        linked_video_asset_id: video.id,
        created_at: this.now().toISOString(),
      });
    } catch (error) {
      await this.deletePersistedFile(persistedThumbnail.storage_path);
      throw error;
    }

    if (thumbnailRecord.linked_video_asset_id !== video.id) {
      thumbnailRecord = await this.repository.update(thumbnailRecord.id, {
        linked_video_asset_id: video.id,
      }) ?? thumbnailRecord;
    }

    return toResponseDto(thumbnailRecord);
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
      return null;
    }

    return asset;
  }

  async updateAssetDuration(id: string, durationSeconds: number, ownerEmail?: string): Promise<MediaAssetResponseDto | null> {
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      return null;
    }

    const asset = await this.getAsset(id, ownerEmail);
    if (!asset || asset.asset_type !== 'video') {
      return null;
    }

    const updated = await this.repository.update(asset.id, {
      duration_seconds: Math.round(durationSeconds),
    });
    if (!updated) {
      return null;
    }

    const thumbnail = await this.repository.findThumbnailByVideoId(updated.id);
    return toResponseDto(updated, thumbnail ?? undefined);
  }

  async getAssetFile(id: string, ownerEmail?: string): Promise<MediaAssetFileRecord | null> {
    const asset = await this.getAsset(id, ownerEmail);
    if (!asset) {
      return null;
    }

    return {
      asset,
      absolute_path: await this.storage.materialize(asset.storage_path),
    };
  }

  async deleteAsset(id: string, ownerEmail?: string): Promise<boolean> {
    const asset = await this.getAsset(id, ownerEmail);
    if (!asset) {
      return false;
    }

    const deleted = await this.repository.delete(asset.id);
    if (!deleted) {
      return false;
    }

    await this.deletePersistedFile(asset.storage_path);
    return true;
  }

  async cleanupOrphanedFiles(options: { force?: boolean } = {}): Promise<OrphanCleanupResult> {
    if (!this.orphanCleanupEnabled) {
      return { scanned: 0, deleted: 0, retained: 0, failed: 0, skipped: true };
    }

    if (this.orphanCleanupPromise) {
      return this.orphanCleanupPromise;
    }

    const nowMs = this.now().getTime();
    if (!options.force && nowMs - this.lastOrphanCleanupAtMs < this.orphanCleanupIntervalMs) {
      return { scanned: 0, deleted: 0, retained: 0, failed: 0, skipped: true };
    }

    this.orphanCleanupPromise = this.performOrphanCleanup(nowMs);
    try {
      return await this.orphanCleanupPromise;
    } finally {
      this.orphanCleanupPromise = null;
    }
  }

  async linkThumbnail(thumbnailId: string, videoAssetId: string, ownerEmail?: string): Promise<boolean> {
    const thumbnail = await this.getAsset(thumbnailId, ownerEmail);
    if (!thumbnail) return false;
    const video = await this.getAsset(videoAssetId, ownerEmail);
    if (!video) return false;
    const updated = await this.repository.update(thumbnailId, { linked_video_asset_id: videoAssetId });
    return updated !== null;
  }

  private async performOrphanCleanup(nowMs: number): Promise<OrphanCleanupResult> {
    const assets = await this.repository.findAllNewestFirst();
    const referencedPaths = new Set(assets.map((asset) => this.normalizeStoragePath(asset.storage_path)));
    const managedFiles = await this.storage.listManagedFiles();
    const result: OrphanCleanupResult = {
      scanned: managedFiles.length,
      deleted: 0,
      retained: 0,
      failed: 0,
      skipped: false,
    };
    const deleteBeforeMs = Math.max(nowMs, this.now().getTime()) - this.orphanGracePeriodMs;

    for (const file of managedFiles) {
      const isReferenced = referencedPaths.has(this.normalizeStoragePath(file.storagePath));
      const isInsideGracePeriod = file.modifiedAtMs > deleteBeforeMs;
      if (isReferenced || isInsideGracePeriod) {
        result.retained += 1;
        continue;
      }

      try {
        if (await this.storage.delete(file.storagePath)) {
          result.deleted += 1;
        }
      } catch {
        result.failed += 1;
      }
    }

    this.lastOrphanCleanupAtMs = nowMs;
    return result;
  }

  private normalizeStoragePath(storagePath: string): string {
    return storagePath.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
  }

  private async deletePersistedFile(storagePath: string): Promise<void> {
    try {
      await this.storage.delete(storagePath);
    } catch (error) {
      console.warn(`[media] Failed to delete managed file ${storagePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
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
