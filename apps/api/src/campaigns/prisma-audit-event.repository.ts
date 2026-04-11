import type { AuditEventRecord } from './audit-event.service';

interface PrismaClient {
  auditEvent: {
    create(args: { data: any }): Promise<any>;
    findMany(args: { where?: any; orderBy?: any }): Promise<any[]>;
  };
}

function toAuditEventRecord(row: any): AuditEventRecord {
  return {
    id: row.id,
    eventType: row.eventType,
    actorEmail: row.actorEmail,
    campaignId: row.campaignId,
    targetId: row.targetId ?? null,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

export class PrismaAuditEventRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(record: AuditEventRecord): Promise<AuditEventRecord> {
    const row = await this.prisma.auditEvent.create({
      data: {
        id: record.id,
        eventType: record.eventType,
        actorEmail: record.actorEmail,
        campaignId: record.campaignId,
        targetId: record.targetId,
        createdAt: record.createdAt,
      },
    });
    return toAuditEventRecord(row);
  }

  async findAllNewestFirst(): Promise<AuditEventRecord[]> {
    const rows = await this.prisma.auditEvent.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toAuditEventRecord);
  }
}

