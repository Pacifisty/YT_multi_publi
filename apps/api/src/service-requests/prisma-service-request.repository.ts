import type {
  CreateServiceRequestInput,
  ServiceRequestCategory,
  ServiceRequestRecord,
  ServiceRequestRepository,
  ServiceRequestStatus,
} from './service-request.repository';

interface PrismaClientLike {
  serviceRequest: {
    create(args: { data: Record<string, unknown> }): Promise<any>;
    findUnique(args: { where: { protocol: string } }): Promise<any>;
    findMany(args: { where: { ownerEmail: string }; orderBy: { createdAt: 'desc' } }): Promise<any[]>;
  };
}

export class PrismaServiceRequestRepository implements ServiceRequestRepository {
  constructor(private readonly prisma: PrismaClientLike) {}

  async create(input: CreateServiceRequestInput): Promise<ServiceRequestRecord> {
    const row = await this.prisma.serviceRequest.create({ data: input });
    return toRecord(row);
  }

  async findByProtocol(protocol: string): Promise<ServiceRequestRecord | null> {
    const row = await this.prisma.serviceRequest.findUnique({
      where: { protocol: protocol.trim().toUpperCase() },
    });
    return row ? toRecord(row) : null;
  }

  async listByOwnerEmail(ownerEmail: string): Promise<ServiceRequestRecord[]> {
    const rows = await this.prisma.serviceRequest.findMany({
      where: { ownerEmail: ownerEmail.trim().toLowerCase() },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toRecord);
  }
}

function toRecord(row: any): ServiceRequestRecord {
  return {
    id: row.id,
    protocol: row.protocol,
    ownerEmail: row.ownerEmail,
    requesterName: row.requesterName ?? null,
    category: row.category as ServiceRequestCategory,
    subject: row.subject,
    description: row.description,
    status: row.status as ServiceRequestStatus,
    trackingTokenHash: row.trackingTokenHash,
    createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
  };
}
