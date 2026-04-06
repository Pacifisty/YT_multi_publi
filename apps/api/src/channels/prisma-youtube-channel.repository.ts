import type { YouTubeChannel, CreateYouTubeChannelDto, YouTubeChannelRepository } from './youtube-channel.service';
import { randomUUID } from 'node:crypto';

interface PrismaClient {
  youTubeChannel: {
    create(args: { data: any }): Promise<any>;
    findUnique(args: { where: { id: string } }): Promise<any>;
    findFirst(args: { where?: any }): Promise<any>;
    findMany(args: { where?: any }): Promise<any[]>;
    update(args: { where: { id: string }; data: any }): Promise<any>;
    delete(args: { where: { id: string } }): Promise<any>;
  };
}

function toYouTubeChannel(row: any): YouTubeChannel {
  return {
    id: row.id,
    connectedAccountId: row.connectedAccountId,
    youtubeChannelId: row.youtubeChannelId,
    title: row.title,
    handle: row.handle ?? null,
    thumbnailUrl: row.thumbnailUrl ?? null,
    isActive: row.isActive,
    lastSyncedAt: row.lastSyncedAt instanceof Date ? row.lastSyncedAt : new Date(row.lastSyncedAt),
  };
}

export class PrismaYouTubeChannelRepository implements YouTubeChannelRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(dto: CreateYouTubeChannelDto): Promise<YouTubeChannel> {
    const row = await this.prisma.youTubeChannel.create({
      data: {
        id: randomUUID(),
        connectedAccountId: dto.connectedAccountId,
        youtubeChannelId: dto.youtubeChannelId,
        title: dto.title,
        handle: dto.handle ?? null,
        thumbnailUrl: dto.thumbnailUrl ?? null,
        isActive: true,
        lastSyncedAt: new Date(),
      },
    });
    return toYouTubeChannel(row);
  }

  async findById(id: string): Promise<YouTubeChannel | null> {
    const row = await this.prisma.youTubeChannel.findUnique({ where: { id } });
    if (!row) return null;
    return toYouTubeChannel(row);
  }

  async findByAccountAndChannelId(accountId: string, channelId: string): Promise<YouTubeChannel | null> {
    const row = await this.prisma.youTubeChannel.findFirst({
      where: { connectedAccountId: accountId, youtubeChannelId: channelId },
    });
    if (!row) return null;
    return toYouTubeChannel(row);
  }

  async findByAccount(accountId: string): Promise<YouTubeChannel[]> {
    const rows = await this.prisma.youTubeChannel.findMany({
      where: { connectedAccountId: accountId },
    });
    return rows.map(toYouTubeChannel);
  }

  async findActive(): Promise<YouTubeChannel[]> {
    const rows = await this.prisma.youTubeChannel.findMany({
      where: { isActive: true },
    });
    return rows.map(toYouTubeChannel);
  }

  async update(id: string, data: Partial<YouTubeChannel>): Promise<YouTubeChannel | null> {
    try {
      const row = await this.prisma.youTubeChannel.update({
        where: { id },
        data,
      });
      return toYouTubeChannel(row);
    } catch (error: any) {
      if (error.code === 'P2025') return null;
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.youTubeChannel.delete({ where: { id } });
      return true;
    } catch (error: any) {
      if (error.code === 'P2025') return false;
      throw error;
    }
  }
}
