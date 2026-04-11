import type { CampaignRecord, CampaignTargetRecord } from './campaign.service';

interface PrismaClient {
  campaign: {
    create(args: { data: any }): Promise<any>;
    findUnique(args: { where: { id: string }; include?: any }): Promise<any>;
    findMany(args: { orderBy?: any; include?: any }): Promise<any[]>;
    update(args: { where: { id: string }; data: any; include?: any }): Promise<any>;
    delete(args: { where: { id: string } }): Promise<any>;
  };
  campaignTarget: {
    create(args: { data: any }): Promise<any>;
    delete(args: { where: { id: string } }): Promise<any>;
    update(args: { where: { id: string }; data: any }): Promise<any>;
  };
}

function toCampaignRecord(row: any): CampaignRecord {
  return {
    id: row.id,
    title: row.title,
    videoAssetId: row.videoAssetId,
    status: row.status,
    scheduledAt: row.scheduledAt ? new Date(row.scheduledAt).toISOString() : null,
    targets: (row.targets ?? []).map(toTargetRecord),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

function toTargetRecord(row: any): CampaignTargetRecord {
  return {
    id: row.id,
    campaignId: row.campaignId,
    channelId: row.channelId,
    videoTitle: row.videoTitle,
    videoDescription: row.videoDescription,
    tags: row.tags ?? [],
    publishAt: row.publishAt ? new Date(row.publishAt).toISOString() : null,
    playlistId: row.playlistId ?? null,
    privacy: row.privacy ?? 'private',
    thumbnailAssetId: row.thumbnailAssetId ?? null,
    status: row.status,
    youtubeVideoId: row.youtubeVideoId ?? null,
    errorMessage: row.errorMessage ?? null,
    retryCount: row.retryCount ?? 0,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt,
  };
}

export class PrismaCampaignRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(record: CampaignRecord): Promise<CampaignRecord> {
    const row = await this.prisma.campaign.create({
      data: {
        id: record.id,
        title: record.title,
        videoAssetId: record.videoAssetId,
        status: record.status,
        scheduledAt: record.scheduledAt,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      },
    });
    return toCampaignRecord({ ...row, targets: [] });
  }

  async findById(id: string): Promise<CampaignRecord | null> {
    const row = await this.prisma.campaign.findUnique({
      where: { id },
      include: { targets: true },
    });
    if (!row) return null;
    return toCampaignRecord(row);
  }

  async findAllNewestFirst(): Promise<CampaignRecord[]> {
    const rows = await this.prisma.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: { targets: true },
    });
    return rows.map(toCampaignRecord);
  }

  async update(id: string, updates: Partial<CampaignRecord>): Promise<CampaignRecord | null> {
    const { targets, ...data } = updates;
    const row = await this.prisma.campaign.update({
      where: { id },
      data,
      include: { targets: true },
    });
    if (!row) return null;
    return toCampaignRecord(row);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.prisma.campaign.delete({ where: { id } });
    return result !== null;
  }

  async addTarget(campaignId: string, target: CampaignTargetRecord): Promise<CampaignTargetRecord | null> {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) return null;

    const row = await this.prisma.campaignTarget.create({
      data: {
        id: target.id,
        campaignId: target.campaignId,
        channelId: target.channelId,
        videoTitle: target.videoTitle,
        videoDescription: target.videoDescription,
        tags: target.tags,
        publishAt: target.publishAt,
        playlistId: target.playlistId,
        privacy: target.privacy,
        thumbnailAssetId: target.thumbnailAssetId,
        status: target.status,
        youtubeVideoId: target.youtubeVideoId,
        errorMessage: target.errorMessage,
        retryCount: target.retryCount,
        createdAt: target.createdAt,
        updatedAt: target.updatedAt,
      },
    });
    return toTargetRecord(row);
  }

  async removeTarget(campaignId: string, targetId: string): Promise<boolean> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { targets: true },
    });
    if (!campaign) return false;

    const target = campaign.targets.find((t: any) => t.id === targetId);
    if (!target) return false;

    await this.prisma.campaignTarget.delete({ where: { id: targetId } });
    return true;
  }

  async updateTarget(
    campaignId: string,
    targetId: string,
    updates: Partial<CampaignTargetRecord>,
  ): Promise<CampaignTargetRecord | null> {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { targets: true },
    });
    if (!campaign) return null;

    const target = campaign.targets.find((t: any) => t.id === targetId);
    if (!target) return null;

    const { campaignId: _cid, id: _id, ...data } = updates;
    const row = await this.prisma.campaignTarget.update({
      where: { id: targetId },
      data,
    });
    return toTargetRecord(row);
  }
}
