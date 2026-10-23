import type { UploadedMediaFile } from '../storage/local-storage.service';

export interface CreateMediaAssetDto {
  video: UploadedMediaFile;
  thumbnail?: UploadedMediaFile;
}

export interface MediaAssetResponseDto {
  id: string;
  asset_type: 'video' | 'thumbnail';
  original_name: string;
  storage_path: string;
  source_path?: string | null;
  size_bytes: number;
  mime_type: string;
  duration_seconds: number;
  linked_video_asset_id: string | null;
  created_at: string;
  thumbnail?: MediaAssetResponseDto;
}
