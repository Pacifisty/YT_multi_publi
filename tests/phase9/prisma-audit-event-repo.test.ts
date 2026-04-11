import { describe, expect, test } from 'vitest';

import { PrismaAuditEventRepository } from '../../apps/api/src/campaigns/prisma-audit-event.repository';
import type { AuditEventRecord } from '../../apps/api/src/campaigns/audit-event.service';

function makeMockPrisma() {
  const events: any[] = [];

  return {
    auditEvent: {
      create: async ({ data }: any) => {
        const record = { ...data };
        events.push(record);
        return record;
      },
      findMany: async ({ orderBy }: any) => {
        const result = [...events];
        if (orderBy?.createdAt === 'desc') {
          result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }
        return result;
      },
    },
  };
}

describe('PrismaAuditEventRepository', () => {
  test('create stores and returns an audit event', async () => {
    const prisma = makeMockPrisma();
    const repo = new PrismaAuditEventRepository(prisma as any);

    const record: AuditEventRecord = {
      id: 'audit-1',
      eventType: 'launch_campaign',
      actorEmail: 'ops@test.com',
      campaignId: 'c1',
      targetId: null,
      createdAt: '2026-04-10T00:00:00Z',
    };

    const result = await repo.create(record);
    expect(result).toEqual(record);
  });

  test('findAllNewestFirst returns events ordered by createdAt descending', async () => {
    const prisma = makeMockPrisma();
    const repo = new PrismaAuditEventRepository(prisma as any);

    await repo.create({
      id: 'audit-old',
      eventType: 'launch_campaign',
      actorEmail: 'ops@test.com',
      campaignId: 'c1',
      targetId: null,
      createdAt: '2026-04-10T00:00:00Z',
    });
    await repo.create({
      id: 'audit-new',
      eventType: 'publish_completed',
      actorEmail: 'system@internal',
      campaignId: 'c1',
      targetId: 't1',
      createdAt: '2026-04-10T00:01:00Z',
    });

    const result = await repo.findAllNewestFirst();
    expect(result.map((event) => event.id)).toEqual(['audit-new', 'audit-old']);
  });
});

