import { randomUUID } from 'node:crypto';

export type MediaAssetType = 'video' | 'thumbnail';

export interface MediaAsset {
  id: string;
  ownerEmail?: string | null;
  assetType: MediaAssetType;
  originalName: string;
  storagePath: string;
  sizeBytes: number;
  mimeType: string;
  durationSeconds: number;
  linkedVideoAssetId: string | null;
  createdAt: Date;
}

export interface CreateMediaAssetDto {
  ownerEmail?: string | null;
  assetType: string;
  originalName: string;
  storagePath: string;
  sizeBytes: number;
  mimeType: string;
  durationSeconds?: number;
}

export interface MediaAssetRepository {
  create(dto: CreateMediaAssetDto): Promise<MediaAsset>;
  findById(id: string): Promise<MediaAsset | null>;
  findAll(): Promise<MediaAsset[]>;
  findByType(type: MediaAssetType): Promise<MediaAsset[]>;
  delete(id: string): Promise<boolean>;
  update(id: string, data: Partial<MediaAsset>): Promise<MediaAsset | null>;
}

const VALID_TYPES: Set<string> = new Set(['video', 'thumbnail']);

function validate(dto: CreateMediaAssetDto): void {
  if (!VALID_TYPES.has(dto.assetType)) {
    throw new Error('Invalid asset type');
  }
  if (!dto.originalName) {
    throw new Error('originalName is required');
  }
  if (!dto.storagePath) {
    throw new Error('storagePath is required');
  }
  if (!dto.sizeBytes || dto.sizeBytes <= 0) {
    throw new Error('sizeBytes must be positive');
  }
}

export class MediaAssetService {
  constructor(private readonly repo: MediaAssetRepository) {}

  async create(dto: CreateMediaAssetDto): Promise<{ asset: MediaAsset }> {
    validate(dto);
    const asset = await this.repo.create(dto);
    return { asset };
  }

  async getById(id: string): Promise<MediaAsset | null> {
    return this.repo.findById(id);
  }

  async list(): Promise<MediaAsset[]> {
    return this.repo.findAll();
  }

  async listByType(type: MediaAssetType): Promise<MediaAsset[]> {
    return this.repo.findByType(type);
  }

  async delete(id: string): Promise<boolean> {
    return this.repo.delete(id);
  }

  async linkThumbnail(thumbnailId: string, videoId: string): Promise<boolean> {
    const thumb = await this.repo.findById(thumbnailId);
    if (!thumb) return false;

    const video = await this.repo.findById(videoId);
    if (!video) return false;

    const updated = await this.repo.update(thumbnailId, { linkedVideoAssetId: videoId });
    return updated !== null;
  }
}

export class InMemoryMediaAssetRepository implements MediaAssetRepository {
  private assets = new Map<string, MediaAsset>();

  async create(dto: CreateMediaAssetDto): Promise<MediaAsset> {
    const asset: MediaAsset = {
      id: randomUUID(),
      ownerEmail: dto.ownerEmail ?? null,
      assetType: dto.assetType as MediaAssetType,
      originalName: dto.originalName,
      storagePath: dto.storagePath,
      sizeBytes: dto.sizeBytes,
      mimeType: dto.mimeType,
      durationSeconds: dto.durationSeconds ?? 0,
      linkedVideoAssetId: null,
      createdAt: new Date(),
    };
    this.assets.set(asset.id, asset);
    return { ...asset };
  }

  async findById(id: string): Promise<MediaAsset | null> {
    const asset = this.assets.get(id);
    return asset ? { ...asset } : null;
  }

  async findAll(): Promise<MediaAsset[]> {
    return [...this.assets.values()].map((a) => ({ ...a }));
  }

  async findByType(type: MediaAssetType): Promise<MediaAsset[]> {
    return [...this.assets.values()]
      .filter((a) => a.assetType === type)
      .map((a) => ({ ...a }));
  }

  async delete(id: string): Promise<boolean> {
    return this.assets.delete(id);
  }

  async update(id: string, data: Partial<MediaAsset>): Promise<MediaAsset | null> {
    const asset = this.assets.get(id);
    if (!asset) return null;
    Object.assign(asset, data);
    return { ...asset };
  }
}
