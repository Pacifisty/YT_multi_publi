import { describe, it, expect, vi } from 'vitest';
import {
  PublishJobService,
  type PublishJobRepository,
  type PublishJobRecord,
} from '../../apps/api/src/campaigns/publish-job.service';
import { PrismaPublishJobRepository } from '../../apps/api/src/campaigns/prisma-publish-job.repository';
import { bootstrap } from '../../apps/api/src/bootstrap';

// Async mock repository — wraps all returns in Promises
class AsyncMockJobRepository implements PublishJobRepository {
  private readonly jobs: PublishJobRecord[] = [];

  async create(record: PublishJobRecord): Promise<PublishJobRecord> {
    this.jobs.push(record);
    return record;
  }

  async findById(id: string): Promise<PublishJobRecord | null> {
    return this.jobs.find((j) => j.id === id) ?? null;
  }

  async findByTargetId(targetId: string): Promise<PublishJobRecord[]> {
    return this.jobs.filter((j) => j.campaignTargetId === targetId);
  }

  async findAll(): Promise<PublishJobRecord[]> {
    return [...this.jobs];
  }

  async findNextQueued(): Promise<PublishJobRecord | null> {
    return this.jobs.find((j) => j.status === 'queued') ?? null;
  }

  async update(id: string, updates: Partial<PublishJobRecord>): Promise<PublishJobRecord | null> {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) return null;
    Object.assign(job, updates);
    return job;
  }
}

describe('PublishJobService with async repository', () => {
  it('enqueueForTargets works with async repository', async () => {
    const repo = new AsyncMockJobRepository();
    const service = new PublishJobService({ repository: repo });

    const jobs = await service.enqueueForTargets([
      { id: 't1', campaignId: 'c1' },
      { id: 't2', campaignId: 'c1' },
    ]);

    expect(jobs).toHaveLength(2);
    expect(jobs[0].status).toBe('queued');
    expect(jobs[1].campaignTargetId).toBe('t2');
  });

  it('pickNext works with async repository', async () => {
    const repo = new AsyncMockJobRepository();
    const service = new PublishJobService({ repository: repo });

    await service.enqueueForTargets([{ id: 't1', campaignId: 'c1' }]);
    const picked = await service.pickNext();

    expect(picked).not.toBeNull();
    expect(picked!.status).toBe('processing');
  });

  it('markCompleted works with async repository', async () => {
    const repo = new AsyncMockJobRepository();
    const service = new PublishJobService({ repository: repo });

    const [job] = await service.enqueueForTargets([{ id: 't1', campaignId: 'c1' }]);
    const picked = await service.pickNext();
    const completed = await service.markCompleted(job.id, 'yt-abc');

    expect(completed).not.toBeNull();
    expect(completed!.status).toBe('completed');
    expect(completed!.youtubeVideoId).toBe('yt-abc');
  });

  it('markFailed works with async repository', async () => {
    const repo = new AsyncMockJobRepository();
    const service = new PublishJobService({ repository: repo });

    const [job] = await service.enqueueForTargets([{ id: 't1', campaignId: 'c1' }]);
    await service.pickNext();
    const failed = await service.markFailed(job.id, 'Upload error');

    expect(failed).not.toBeNull();
    expect(failed!.status).toBe('failed');
    expect(failed!.errorMessage).toBe('Upload error');
  });

  it('retry works with async repository', async () => {
    const repo = new AsyncMockJobRepository();
    const service = new PublishJobService({ repository: repo });

    const [job] = await service.enqueueForTargets([{ id: 't1', campaignId: 'c1' }]);
    await service.pickNext();
    await service.markFailed(job.id, 'err');
    const retried = await service.retry(job.id);

    expect(retried).toHaveProperty('status', 'queued');
    expect((retried as PublishJobRecord).attempt).toBe(2);
  });

  it('getJobsForTarget works with async repository', async () => {
    const repo = new AsyncMockJobRepository();
    const service = new PublishJobService({ repository: repo });

    await service.enqueueForTargets([
      { id: 't1', campaignId: 'c1' },
      { id: 't2', campaignId: 'c1' },
    ]);

    const jobs = await service.getJobsForTarget('t1');
    expect(jobs).toHaveLength(1);
    expect(jobs[0].campaignTargetId).toBe('t1');
  });

  it('getAllJobs works with async repository', async () => {
    const repo = new AsyncMockJobRepository();
    const service = new PublishJobService({ repository: repo });

    await service.enqueueForTargets([
      { id: 't1', campaignId: 'c1' },
      { id: 't2', campaignId: 'c1' },
    ]);

    const all = await service.getAllJobs();
    expect(all).toHaveLength(2);
  });

  it('enqueueForTargets skips duplicate jobs for targets that already have history', async () => {
    const repo = new AsyncMockJobRepository();
    const service = new PublishJobService({ repository: repo });

    const first = await service.enqueueForTargets([{ id: 't1', campaignId: 'c1' }]);
    const second = await service.enqueueForTargets([{ id: 't1', campaignId: 'c1' }]);

    expect(first).toHaveLength(1);
    expect(second).toHaveLength(0);
    expect(await service.getJobsForTarget('t1')).toHaveLength(1);
  });
});

// Minimal mock Prisma for publish jobs
function makeMockPrisma() {
  const campaigns: any[] = [];
  const targets: any[] = [];
  const jobs: any[] = [];

  return {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    campaign: {
      create: vi.fn(async ({ data }: any) => {
        const record = { ...data, targets: [] };
        campaigns.push(record);
        return record;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        const c = campaigns.find((c: any) => c.id === where.id);
        if (!c) return null;
        return { ...c, targets: targets.filter((t: any) => t.campaignId === c.id) };
      }),
      findMany: vi.fn(async () =>
        campaigns.map((c) => ({
          ...c,
          targets: targets.filter((t: any) => t.campaignId === c.id),
        })),
      ),
      update: vi.fn(async ({ where, data }: any) => {
        const c = campaigns.find((c: any) => c.id === where.id);
        if (!c) return null;
        Object.assign(c, data);
        return { ...c, targets: targets.filter((t: any) => t.campaignId === c.id) };
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = campaigns.findIndex((c: any) => c.id === where.id);
        if (idx === -1) return null;
        return campaigns.splice(idx, 1)[0];
      }),
    },
    campaignTarget: {
      create: vi.fn(async ({ data }: any) => {
        targets.push(data);
        return data;
      }),
      delete: vi.fn(async ({ where }: any) => {
        const idx = targets.findIndex((t: any) => t.id === where.id);
        if (idx === -1) return null;
        return targets.splice(idx, 1)[0];
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const t = targets.find((t: any) => t.id === where.id);
        if (!t) return null;
        Object.assign(t, data);
        return t;
      }),
    },
    publishJob: {
      create: vi.fn(async ({ data }: any) => {
        jobs.push(data);
        return data;
      }),
      findUnique: vi.fn(async ({ where }: any) => {
        return jobs.find((j: any) => j.id === where.id) ?? null;
      }),
      findMany: vi.fn(async ({ where }: any) => {
        if (where?.campaignTargetId) {
          return jobs.filter((j: any) => j.campaignTargetId === where.campaignTargetId);
        }
        return [...jobs];
      }),
      findFirst: vi.fn(async ({ where }: any) => {
        if (where?.status === 'queued') {
          return jobs.find((j: any) => j.status === 'queued') ?? null;
        }
        return null;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const j = jobs.find((j: any) => j.id === where.id);
        if (!j) return null;
        Object.assign(j, data);
        return j;
      }),
    },
    _data: { campaigns, targets, jobs },
  };
}

const baseEnv = {
  OAUTH_TOKEN_KEY: 'a]3Fk9$2mP!xL7nQ&vR4wY6zA0cE8gI5',
  NODE_ENV: 'development',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_PASSWORD_HASH: 'plain:secret123',
  DATABASE_URL: 'postgresql://localhost:5432/test',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/auth/callback',
};

describe('Bootstrap wires PrismaPublishJobRepository', () => {
  it('databaseProvider exposes publishJobRepository when _prismaFactory is provided', () => {
    const mockPrisma = makeMockPrisma();
    const result = bootstrap({
      env: baseEnv,
      _prismaFactory: () => mockPrisma,
    });

    expect(result.databaseProvider.publishJobRepository).toBeInstanceOf(PrismaPublishJobRepository);
  });

  it('publishJobRepository is null when no _prismaFactory', () => {
    const result = bootstrap({ env: baseEnv });
    expect(result.databaseProvider.publishJobRepository).toBeNull();
  });

  it('enqueue jobs through Prisma repo via bootstrapped app', async () => {
    const mockPrisma = makeMockPrisma();
    const result = bootstrap({
      env: baseEnv,
      _prismaFactory: () => mockPrisma,
    });

    const jobService = result.server.app.campaignsModule.jobService;
    const jobs = await jobService.enqueueForTargets([
      { id: 't1', campaignId: 'c1' },
    ]);

    expect(jobs).toHaveLength(1);
    expect(mockPrisma.publishJob.create).toHaveBeenCalledTimes(1);
  });

  it('pick and complete job through Prisma repo', async () => {
    const mockPrisma = makeMockPrisma();
    const result = bootstrap({
      env: baseEnv,
      _prismaFactory: () => mockPrisma,
    });

    const jobService = result.server.app.campaignsModule.jobService;
    const [job] = await jobService.enqueueForTargets([
      { id: 't1', campaignId: 'c1' },
    ]);
    const picked = await jobService.pickNext();
    expect(picked).not.toBeNull();
    expect(picked!.status).toBe('processing');

    const completed = await jobService.markCompleted(job.id, 'yt-123');
    expect(completed!.status).toBe('completed');
  });
});
