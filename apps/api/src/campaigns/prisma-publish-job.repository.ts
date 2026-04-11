import type { PublishJobRecord } from './publish-job.service';

interface PrismaClient {
  publishJob: {
    create(args: { data: any }): Promise<any>;
    findUnique(args: { where: { id: string } }): Promise<any>;
    findMany(args: { where?: any; orderBy?: any }): Promise<any[]>;
    findFirst(args: { where?: any; orderBy?: any }): Promise<any>;
    update(args: { where: { id: string }; data: any }): Promise<any>;
  };
}

function toJobRecord(row: any): PublishJobRecord {
  return {
    id: row.id,
    campaignTargetId: row.campaignTargetId,
    status: row.status,
    attempt: row.attempt,
    progressPercent: row.progressPercent,
    youtubeVideoId: row.youtubeVideoId ?? null,
    errorMessage: row.errorMessage ?? null,
    startedAt: row.startedAt instanceof Date ? row.startedAt.toISOString() : row.startedAt,
    completedAt: row.completedAt instanceof Date ? row.completedAt.toISOString() : row.completedAt,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

export class PrismaPublishJobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(record: PublishJobRecord): Promise<PublishJobRecord> {
    const row = await this.prisma.publishJob.create({
      data: {
        id: record.id,
        campaignTargetId: record.campaignTargetId,
        status: record.status,
        attempt: record.attempt,
        progressPercent: record.progressPercent,
        youtubeVideoId: record.youtubeVideoId,
        errorMessage: record.errorMessage,
        startedAt: record.startedAt,
        completedAt: record.completedAt,
        createdAt: record.createdAt,
      },
    });
    return toJobRecord(row);
  }

  async findById(id: string): Promise<PublishJobRecord | null> {
    const row = await this.prisma.publishJob.findUnique({ where: { id } });
    if (!row) return null;
    return toJobRecord(row);
  }

  async findByTargetId(targetId: string): Promise<PublishJobRecord[]> {
    const rows = await this.prisma.publishJob.findMany({
      where: { campaignTargetId: targetId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toJobRecord);
  }

  async findAll(): Promise<PublishJobRecord[]> {
    const rows = await this.prisma.publishJob.findMany({});
    return rows.map(toJobRecord);
  }

  async findNextQueued(): Promise<PublishJobRecord | null> {
    const row = await this.prisma.publishJob.findFirst({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' },
    });
    if (!row) return null;
    return toJobRecord(row);
  }

  async update(id: string, updates: Partial<PublishJobRecord>): Promise<PublishJobRecord | null> {
    const row = await this.prisma.publishJob.update({
      where: { id },
      data: updates,
    });
    if (!row) return null;
    return toJobRecord(row);
  }
}
