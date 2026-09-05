import { randomUUID } from 'node:crypto';

export const SERVICE_REQUEST_CATEGORIES = [
  'access',
  'technical',
  'billing',
  'privacy',
  'account',
  'other',
] as const;

export type ServiceRequestCategory = typeof SERVICE_REQUEST_CATEGORIES[number];
export type ServiceRequestStatus = 'received' | 'in_review' | 'waiting_user' | 'resolved' | 'closed';

export interface ServiceRequestRecord {
  id: string;
  protocol: string;
  ownerEmail: string;
  requesterName: string | null;
  category: ServiceRequestCategory;
  subject: string;
  description: string;
  status: ServiceRequestStatus;
  trackingTokenHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateServiceRequestInput = Omit<ServiceRequestRecord, 'id'>;

export interface ServiceRequestRepository {
  create(input: CreateServiceRequestInput): Promise<ServiceRequestRecord>;
  findByProtocol(protocol: string): Promise<ServiceRequestRecord | null>;
  listByOwnerEmail(ownerEmail: string): Promise<ServiceRequestRecord[]>;
}

export class InMemoryServiceRequestRepository implements ServiceRequestRepository {
  private readonly records = new Map<string, ServiceRequestRecord>();

  async create(input: CreateServiceRequestInput): Promise<ServiceRequestRecord> {
    const record: ServiceRequestRecord = {
      id: randomUUID(),
      ...input,
      ownerEmail: normalizeEmail(input.ownerEmail),
      createdAt: new Date(input.createdAt),
      updatedAt: new Date(input.updatedAt),
    };
    this.records.set(record.protocol, record);
    return cloneRecord(record);
  }

  async findByProtocol(protocol: string): Promise<ServiceRequestRecord | null> {
    const record = this.records.get(protocol.trim().toUpperCase());
    return record ? cloneRecord(record) : null;
  }

  async listByOwnerEmail(ownerEmail: string): Promise<ServiceRequestRecord[]> {
    const normalizedEmail = normalizeEmail(ownerEmail);
    return Array.from(this.records.values())
      .filter((record) => record.ownerEmail === normalizedEmail)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .map(cloneRecord);
  }
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function cloneRecord(record: ServiceRequestRecord): ServiceRequestRecord {
  return {
    ...record,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}
