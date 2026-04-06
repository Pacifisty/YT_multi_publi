import type { MediaAssetRepository, MediaAsset } from '../media/media-asset.service';
import type { MediaRepository } from '../media/media.service';

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

function toRecord(asset: MediaAsset): MediaAssetRecord {
  return {
    id: asset.id,
    asset_type: asset.assetType,
    original_name: asset.originalName,
    storage_path: asset.storagePath,
    size_bytes: asset.sizeBytes,
    mime_type: asset.mimeType,
    duration_seconds: asset.durationSeconds,
    linked_video_asset_id: asset.linkedVideoAssetId,
    created_at: asset.createdAt.toISOString(),
  };
}

export function createMediaRepoAdapter(repo: MediaAssetRepository): MediaRepository {
  return {
    async create(record: MediaAssetRecord): Promise<MediaAssetRecord> {
      const asset = await repo.create({
        assetType: record.asset_type,
        originalName: record.original_name,
        storagePath: record.storage_path,
        sizeBytes: record.size_bytes,
        mimeType: record.mime_type,
        durationSeconds: record.duration_seconds,
      });
      return toRecord(asset);
    },

    async findById(id: string): Promise<MediaAssetRecord | null> {
      const asset = await repo.findById(id);
      return asset ? toRecord(asset) : null;
    },

    async findVideosNewestFirst(): Promise<MediaAssetRecord[]> {
      const videos = await repo.findByType('video');
      return videos
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .map(toRecord);
    },

    async findThumbnailByVideoId(videoAssetId: string): Promise<MediaAssetRecord | null> {
      const thumbnails = await repo.findByType('thumbnail');
      const match = thumbnails.find((t) => t.linkedVideoAssetId === videoAssetId);
      return match ? toRecord(match) : null;
    },

    async delete(id: string): Promise<boolean> {
      return repo.delete(id);
    },

    async update(id: string, data: Partial<MediaAssetRecord>): Promise<MediaAssetRecord | null> {
      const partialAsset: Partial<MediaAsset> = {};
      if (data.original_name !== undefined) partialAsset.originalName = data.original_name;
      if (data.storage_path !== undefined) partialAsset.storagePath = data.storage_path;
      if (data.size_bytes !== undefined) partialAsset.sizeBytes = data.size_bytes;
      if (data.mime_type !== undefined) partialAsset.mimeType = data.mime_type;
      if (data.duration_seconds !== undefined) partialAsset.durationSeconds = data.duration_seconds;
      if (data.linked_video_asset_id !== undefined) partialAsset.linkedVideoAssetId = data.linked_video_asset_id;
      if (data.asset_type !== undefined) partialAsset.assetType = data.asset_type;

      const result = await repo.update(id, partialAsset);
      return result ? toRecord(result) : null;
    },
  };
}
