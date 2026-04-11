import { randomUUID } from 'node:crypto';

export type AuditEventType = 'launch_campaign' | 'retry_target' | 'mark_ready' | 'clone_campaign' | 'delete_campaign' | 'update_campaign' | 'remove_target' | 'update_target' | 'add_target' | 'add_targets_bulk' | 'publish_completed' | 'publish_failed' | 'publish_partial_failure';

export interface AuditEventRecord {
  id: string;
  eventType: AuditEventType;
  actorEmail: string;
  campaignId: string;
  targetId: string | null;
  createdAt: string;
}

export interface AuditEventRepository {
  create(record: AuditEventRecord): Promise<AuditEventRecord> | AuditEventRecord;
  findAllNewestFirst(): Promise<AuditEventRecord[]> | AuditEventRecord[];
}

export class InMemoryAuditEventRepository implements AuditEventRepository {
  private readonly events: AuditEventRecord[] = [];

  create(record: AuditEventRecord): AuditEventRecord {
    this.events.push(record);
    return record;
  }

  findAllNewestFirst(): AuditEventRecord[] {
    return [...this.events].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
}

export interface AuditEventServiceOptions {
  repository?: AuditEventRepository;
  now?: () => Date;
}

export class AuditEventService {
  private readonly repository: AuditEventRepository;
  private readonly now: () => Date;

  constructor(options: AuditEventServiceOptions = {}) {
    this.repository = options.repository ?? new InMemoryAuditEventRepository();
    this.now = options.now ?? (() => new Date());
  }

  async record(event: {
    eventType: AuditEventType;
    actorEmail: string;
    campaignId: string;
    targetId?: string | null;
  }): Promise<AuditEventRecord> {
    return await this.repository.create({
      id: randomUUID(),
      eventType: event.eventType,
      actorEmail: event.actorEmail,
      campaignId: event.campaignId,
      targetId: event.targetId ?? null,
      createdAt: this.now().toISOString(),
    });
  }

  async listEvents(limit?: number): Promise<AuditEventRecord[]> {
    const events = await this.repository.findAllNewestFirst();
    return typeof limit === 'number' ? events.slice(0, limit) : events;
  }

  async listEventsForCampaign(campaignId: string, limit?: number): Promise<AuditEventRecord[]> {
    const events = await this.repository.findAllNewestFirst();
    const filteredEvents = events.filter((event) => event.campaignId === campaignId);
    return typeof limit === 'number' ? filteredEvents.slice(0, limit) : filteredEvents;
  }
}
