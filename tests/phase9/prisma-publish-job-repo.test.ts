import { describe, expect, test } from 'vitest';

import {
  PrismaPublishJobRepository,
} from '../../apps/api/src/campaigns/prisma-publish-job.repository';
import type { PublishJobRecord } from '../../apps/api/src/campaigns/publish-job.service';

function makeMockPrisma() {
  const jobs: any[] = [];

  return {
    publishJob: {
      create: async ({ data }: any) => {
        const record = { ...data };
        jobs.push(record);
        return record;
      },
      findUnique: async ({ where }: any) => {
        return jobs.find((j: any) => j.id === where.id) ?? null;
      },
      findMany: async ({ where, orderBy }: any) => {
        let result = [...jobs];
        if (where?.campaignTargetId) {
          result = result.filter((j: any) => j.campaignTargetId === where.campaignTargetId);
        }
        if (where?.status) {
          result = result.filter((j: any) => j.status === where.status);
        }
        if (orderBy?.createdAt === 'asc') {
          result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        }
        return result;
      },
      findFirst: async ({ where, orderBy }: any) => {
        let result = [...jobs];
        if (where?.status) {
          result = result.filter((j: any) => j.status === where.status);
        }
        if (orderBy?.createdAt === 'asc') {
          result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        }
        return result[0] ?? null;
      },
      update: async ({ where, data }: any) => {
        const job = jobs.find((j: any) => j.id === where.id);
        if (!job) return null;
        Object.assign(job, data);
        return job;
      },
    },
    _data: { jobs },
  };
}

describe('PrismaPublishJobRepository', () => {
  test('create stores and returns a job', async () => {
    const prisma = makeMockPrisma();
    const repo = new PrismaPublishJobRepository(prisma as any);

    const record: PublishJobRecord = {
      id: 'j1',
      campaignTargetId: 't1',
      status: 'queued',
      attempt: 1,
      progressPercent: 0,
      youtubeVideoId: null,
      errorMessage: null,
      startedAt: null,
      completedAt: null,
      createdAt: '2026-04-01T00:00:00Z',
    };

    const result = await repo.create(record);
    expect(result.id).toBe('j1');
    expect(result.status).toBe('queued');
  });

  test('findById retrieves a job', async () => {
    const prisma = makeMockPrisma();
    const repo = new PrismaPublishJobRepository(prisma as any);

    await repo.create({
      id: 'j1', campaignTargetId: 't1', status: 'queued',
      attempt: 1, progressPercent: 0, youtubeVideoId: null,
      errorMessage: null, startedAt: null, completedAt: null,
      createdAt: '2026-04-01T00:00:00Z',
    });

    const found = await repo.findById('j1');
    expect(found).not.toBeNull();
    expect(found!.id).toBe('j1');
  });

  test('findById returns null for non-existent job', async () => {
    const prisma = makeMockPrisma();
    const repo = new PrismaPublishJobRepository(prisma as any);

    const result = await repo.findById('nonexistent');
    expect(result).toBeNull();
  });

  test('findByTargetId returns jobs for a specific target', async () => {
    const prisma = makeMockPrisma();
    const repo = new PrismaPublishJobRepository(prisma as any);

    await repo.create({
      id: 'j1', campaignTargetId: 't1', status: 'queued',
      attempt: 1, progressPercent: 0, youtubeVideoId: null,
      errorMessage: null, startedAt: null, completedAt: null,
      createdAt: '2026-04-01T00:00:00Z',
    });
    await repo.create({
      id: 'j2', campaignTargetId: 't2', status: 'queued',
      attempt: 1, progressPercent: 0, youtubeVideoId: null,
      errorMessage: null, startedAt: null, completedAt: null,
      createdAt: '2026-04-01T00:00:00Z',
    });

    const result = await repo.findByTargetId('t1');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('j1');
  });

  test('findAll returns all jobs', async () => {
    const prisma = makeMockPrisma();
    const repo = new PrismaPublishJobRepository(prisma as any);

    await repo.create({
      id: 'j1', campaignTargetId: 't1', status: 'queued',
      attempt: 1, progressPercent: 0, youtubeVideoId: null,
      errorMessage: null, startedAt: null, completedAt: null,
      createdAt: '2026-04-01T00:00:00Z',
    });
    await repo.create({
      id: 'j2', campaignTargetId: 't2', status: 'processing',
      attempt: 1, progressPercent: 50, youtubeVideoId: null,
      errorMessage: null, startedAt: '2026-04-01T00:01:00Z', completedAt: null,
      createdAt: '2026-04-01T00:00:00Z',
    });

    const result = await repo.findAll();
    expect(result).toHaveLength(2);
  });

  test('findNextQueued returns the oldest queued job', async () => {
    const prisma = makeMockPrisma();
    const repo = new PrismaPublishJobRepository(prisma as any);

    await repo.create({
      id: 'j1', campaignTargetId: 't1', status: 'processing',
      attempt: 1, progressPercent: 50, youtubeVideoId: null,
      errorMessage: null, startedAt: '2026-04-01T00:01:00Z', completedAt: null,
      createdAt: '2026-04-01T00:00:00Z',
    });
    await repo.create({
      id: 'j2', campaignTargetId: 't2', status: 'queued',
      attempt: 1, progressPercent: 0, youtubeVideoId: null,
      errorMessage: null, startedAt: null, completedAt: null,
      createdAt: '2026-04-01T00:02:00Z',
    });

    const next = await repo.findNextQueued();
    expect(next).not.toBeNull();
    expect(next!.id).toBe('j2');
  });

  test('findNextQueued returns null when no queued jobs', async () => {
    const prisma = makeMockPrisma();
    const repo = new PrismaPublishJobRepository(prisma as any);

    await repo.create({
      id: 'j1', campaignTargetId: 't1', status: 'processing',
      attempt: 1, progressPercent: 50, youtubeVideoId: null,
      errorMessage: null, startedAt: '2026-04-01T00:01:00Z', completedAt: null,
      createdAt: '2026-04-01T00:00:00Z',
    });

    const next = await repo.findNextQueued();
    expect(next).toBeNull();
  });

  test('update modifies job fields', async () => {
    const prisma = makeMockPrisma();
    const repo = new PrismaPublishJobRepository(prisma as any);

    await repo.create({
      id: 'j1', campaignTargetId: 't1', status: 'queued',
      attempt: 1, progressPercent: 0, youtubeVideoId: null,
      errorMessage: null, startedAt: null, completedAt: null,
      createdAt: '2026-04-01T00:00:00Z',
    });

    const updated = await repo.update('j1', {
      status: 'completed',
      youtubeVideoId: 'yt-abc',
      completedAt: '2026-04-01T01:00:00Z',
    });

    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('completed');
    expect(updated!.youtubeVideoId).toBe('yt-abc');
  });
});
