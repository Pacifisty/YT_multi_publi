import type {
  PlaylistRecord,
  PlaylistItemRecord,
  PlaylistRepository,
  PresetRepository,
  MediaAssetPresetRecord,
} from './playlist.service';

interface PrismaClient {
  playlist: {
    create(args: { data: any; include?: any }): Promise<any>;
    findUnique(args: { where: { id: string }; include?: any }): Promise<any>;
    findMany(args?: { where?: any; include?: any; orderBy?: any }): Promise<any[]>;
    update(args: { where: { id: string }; data: any; include?: any }): Promise<any>;
    delete(args: { where: { id: string } }): Promise<any>;
  };
  playlistItem: {
    create(args: { data: any }): Promise<any>;
    upsert(args: { where: any; create: any; update: any }): Promise<any>;
    update(args: { where: { id: string }; data: any }): Promise<any>;
    updateMany(args: { where: any; data: any }): Promise<{ count: number }>;
    deleteMany(args: { where: any }): Promise<any>;
    findFirst(args: { where: any }): Promise<any>;
  };
  mediaAssetPreset: {
    upsert(args: { where: any; create: any; update: any }): Promise<any>;
    findUnique(args: { where: any }): Promise<any>;
    delete(args: { where: any }): Promise<any>;
  };
}

function toItemRecord(row: any): PlaylistItemRecord {
  return {
    id: row.id,
    playlistId: row.playlistId,
    videoAssetId: row.videoAssetId,
    position: row.position ?? 0,
    usedAt: row.usedAt ? new Date(row.usedAt).toISOString() : null,
    status: row.status ?? 'available',
    reservedAt: row.reservedAt ? new Date(row.reservedAt).toISOString() : null,
    publishedAt: row.publishedAt ? new Date(row.publishedAt).toISOString() : null,
    reservationToken: row.reservationToken ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}

function toPlaylistRecord(row: any): PlaylistRecord {
  return {
    id: row.id,
    ownerEmail: row.ownerEmail ?? null,
    name: row.name,
    folderPath: row.folderPath ?? null,
    items: Array.isArray(row.items) ? row.items.map(toItemRecord) : [],
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

function toPresetRecord(row: any): MediaAssetPresetRecord {
  return {
    id: row.id,
    videoAssetId: row.videoAssetId,
    title: row.title ?? '',
    description: row.description ?? '',
    tags: Array.isArray(row.tags) ? row.tags : [],
    privacy: row.privacy ?? 'private',
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

export class PrismaPlaylistRepository implements PlaylistRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(record: PlaylistRecord): Promise<PlaylistRecord> {
    const row = await this.prisma.playlist.create({
      data: {
        id: record.id,
        ownerEmail: record.ownerEmail,
        name: record.name,
        folderPath: record.folderPath,
      },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    return toPlaylistRecord(row);
  }

  async findById(id: string): Promise<PlaylistRecord | null> {
    const row = await this.prisma.playlist.findUnique({
      where: { id },
      include: { items: { orderBy: { position: 'asc' } } },
    });
    return row ? toPlaylistRecord(row) : null;
  }

  async findAll(ownerEmail?: string): Promise<PlaylistRecord[]> {
    const where = ownerEmail
      ? { ownerEmail: ownerEmail.trim().toLowerCase() }
      : undefined;
    const rows = await this.prisma.playlist.findMany({
      where,
      include: { items: { orderBy: { position: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toPlaylistRecord);
  }

  async update(id: string, data: Partial<PlaylistRecord>): Promise<PlaylistRecord | null> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.folderPath !== undefined) updateData.folderPath = data.folderPath;
    if (data.ownerEmail !== undefined) updateData.ownerEmail = data.ownerEmail;
    const row = await this.prisma.playlist.update({
      where: { id },
      data: updateData,
      include: { items: { orderBy: { position: 'asc' } } },
    });
    return row ? toPlaylistRecord(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.playlist.delete({ where: { id } });
      return true;
    } catch (error: any) {
      if (error?.code === 'P2003') throw new PlaylistDependencyConflictError();
      return false;
    }
  }

  async upsertItem(item: PlaylistItemRecord): Promise<PlaylistItemRecord> {
    const row = await this.prisma.playlistItem.upsert({
      where: {
        playlistId_videoAssetId: {
          playlistId: item.playlistId,
          videoAssetId: item.videoAssetId,
        },
      },
      create: {
        id: item.id,
        playlistId: item.playlistId,
        videoAssetId: item.videoAssetId,
        position: item.position,
        usedAt: item.usedAt ? new Date(item.usedAt) : null,
        status: item.status ?? 'available',
        reservedAt: item.reservedAt ? new Date(item.reservedAt) : null,
        publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
        reservationToken: item.reservationToken ?? null,
      },
      update: {
        position: item.position,
      },
    });
    return toItemRecord(row);
  }

  async markItemUsed(itemId: string, usedAt: string): Promise<boolean> {
    try {
      await this.prisma.playlistItem.update({
        where: { id: itemId },
        data: { usedAt: new Date(usedAt) },
      });
      return true;
    } catch {
      return false;
    }
  }

  async reserveItem(itemId: string, reservationToken: string, reservedAt: string, expectedStatus: PlaylistItemRecord['status'] = 'available'): Promise<PlaylistItemRecord | null> {
    const claimed = await this.prisma.playlistItem.updateMany({
      where: { id: itemId, status: expectedStatus },
      data: { status: 'reserved', reservedAt: new Date(reservedAt), reservationToken },
    });
    if (claimed.count !== 1) return null;
    const row = await this.prisma.playlistItem.findFirst({ where: { id: itemId } });
    return row ? toItemRecord(row) : null;
  }

  async releaseItem(itemId: string, reservationToken?: string): Promise<boolean> {
    const result = await this.prisma.playlistItem.updateMany({
      where: { id: itemId, ...(reservationToken ? { reservationToken } : {}) },
      data: { status: 'available', reservedAt: null, reservationToken: null },
    });
    return result.count > 0;
  }

  async markItemPublished(itemId: string, publishedAt: string): Promise<boolean> {
    const date = new Date(publishedAt);
    const result = await this.prisma.playlistItem.updateMany({
      where: { id: itemId },
      data: { status: 'published', usedAt: date, publishedAt: date, reservedAt: null, reservationToken: null },
    });
    return result.count > 0;
  }

  async removeItem(playlistId: string, videoAssetId: string): Promise<boolean> {
    const result = await this.prisma.playlistItem.deleteMany({
      where: { playlistId, videoAssetId },
    });
    return (result?.count ?? 0) > 0;
  }
}

export class PlaylistDependencyConflictError extends Error {
  constructor() {
    super('A fila está vinculada a campanhas e não pode ser excluída.');
    this.name = 'PlaylistDependencyConflictError';
  }
}

export class PrismaPresetRepository implements PresetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsert(record: MediaAssetPresetRecord): Promise<MediaAssetPresetRecord> {
    const row = await this.prisma.mediaAssetPreset.upsert({
      where: { videoAssetId: record.videoAssetId },
      create: {
        id: record.id,
        videoAssetId: record.videoAssetId,
        title: record.title,
        description: record.description,
        tags: record.tags,
        privacy: record.privacy,
      },
      update: {
        title: record.title,
        description: record.description,
        tags: record.tags,
        privacy: record.privacy,
      },
    });
    return toPresetRecord(row);
  }

  async findByVideoAssetId(videoAssetId: string): Promise<MediaAssetPresetRecord | null> {
    const row = await this.prisma.mediaAssetPreset.findUnique({ where: { videoAssetId } });
    return row ? toPresetRecord(row) : null;
  }

  async delete(videoAssetId: string): Promise<boolean> {
    try {
      await this.prisma.mediaAssetPreset.delete({ where: { videoAssetId } });
      return true;
    } catch {
      return false;
    }
  }
}
