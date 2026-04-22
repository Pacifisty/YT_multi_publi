import type { MediaAsset, MediaAssetType, CreateMediaAssetDto, MediaAssetRepository } from './media-asset.service';
import { randomUUID } from 'node:crypto';

interface PrismaClient {
  mediaAsset: {
    create(args: { data: any }): Promise<any>;
    findUnique(args: { where: { id: string } }): Promise<any>;
    findMany(args: { where?: any }): Promise<any[]>;
    update(args: { where: { id: string }; data: any }): Promise<any>;
    delete(args: { where: { id: string } }): Promise<any>;
  };
}

function toMediaAsset(row: any): MediaAsset {
  return {
    id: row.id,
    ownerEmail: row.ownerEmail ?? null,
    assetType: row.assetType as MediaAssetType,
    originalName: row.originalName,
    storagePath: row.storagePath,
    sizeBytes: row.sizeBytes,
    mimeType: row.mimeType,
    durationSeconds: row.durationSeconds ?? 0,
    linkedVideoAssetId: row.linkedVideoAssetId ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
  };
}

export class PrismaMediaAssetRepository implements MediaAssetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(dto: CreateMediaAssetDto): Promise<MediaAsset> {
    const row = await this.prisma.mediaAsset.create({
      data: {
        id: randomUUID(),
        ownerEmail: dto.ownerEmail ?? null,
        assetType: dto.assetType,
        originalName: dto.originalName,
        storagePath: dto.storagePath,
        sizeBytes: dto.sizeBytes,
        mimeType: dto.mimeType,
        durationSeconds: dto.durationSeconds ?? 0,
      },
    });
    return toMediaAsset(row);
  }

  async findById(id: string): Promise<MediaAsset | null> {
    const row = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!row) return null;
    return toMediaAsset(row);
  }

  async findAll(): Promise<MediaAsset[]> {
    const rows = await this.prisma.mediaAsset.findMany();
    return rows.map(toMediaAsset);
  }

  async findByType(type: MediaAssetType): Promise<MediaAsset[]> {
    const rows = await this.prisma.mediaAsset.findMany({ where: { assetType: type } });
    return rows.map(toMediaAsset);
  }

  async update(id: string, data: Partial<MediaAsset>): Promise<MediaAsset | null> {
    try {
      const row = await this.prisma.mediaAsset.update({
        where: { id },
        data,
      });
      return toMediaAsset(row);
    } catch (error: any) {
      if (error.code === 'P2025') return null;
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.mediaAsset.delete({ where: { id } });
      return true;
    } catch (error: any) {
      if (error.code === 'P2025') return false;
      throw error;
    }
  }
}
