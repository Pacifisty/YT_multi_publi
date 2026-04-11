import { randomUUID } from 'node:crypto';

export interface PublishJobRecord {
  id: string;
  campaignTargetId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  attempt: number;
  progressPercent: number;
  youtubeVideoId: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface PublishJobRepository {
  create(record: PublishJobRecord): Promise<PublishJobRecord> | PublishJobRecord;
  findById(id: string): Promise<PublishJobRecord | null> | PublishJobRecord | null;
  findByTargetId(targetId: string): Promise<PublishJobRecord[]> | PublishJobRecord[];
  findAll(): Promise<PublishJobRecord[]> | PublishJobRecord[];
  findNextQueued(): Promise<PublishJobRecord | null> | PublishJobRecord | null;
  update(id: string, updates: Partial<PublishJobRecord>): Promise<PublishJobRecord | null> | PublishJobRecord | null;
}

export class InMemoryPublishJobRepository implements PublishJobRepository {
  private readonly jobs: PublishJobRecord[] = [];

  create(record: PublishJobRecord): PublishJobRecord {
    this.jobs.push(record);
    return record;
  }

  findById(id: string): PublishJobRecord | null {
    return this.jobs.find((j) => j.id === id) ?? null;
  }

  findByTargetId(targetId: string): PublishJobRecord[] {
    return this.jobs.filter((j) => j.campaignTargetId === targetId);
  }

  findAll(): PublishJobRecord[] {
    return [...this.jobs];
  }

  findNextQueued(): PublishJobRecord | null {
    return this.jobs.find((j) => j.status === 'queued') ?? null;
  }

  update(id: string, updates: Partial<PublishJobRecord>): PublishJobRecord | null {
    const job = this.findById(id);
    if (!job) return null;
    Object.assign(job, updates);
    return job;
  }
}

export interface PublishJobServiceOptions {
  repository?: PublishJobRepository;
  maxAttempts?: number;
  now?: () => Date;
}

export class PublishJobService {
  private readonly repository: PublishJobRepository;
  private readonly maxAttempts: number;
  private readonly now: () => Date;

  constructor(options: PublishJobServiceOptions = {}) {
    this.repository = options.repository ?? new InMemoryPublishJobRepository();
    this.maxAttempts = options.maxAttempts ?? 3;
    this.now = options.now ?? (() => new Date());
  }

  private isDuplicateTargetJobError(error: unknown): boolean {
    return typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002';
  }

  async enqueueForTargets(targets: { id: string; campaignId: string }[]): Promise<PublishJobRecord[]> {
    const nowIso = this.now().toISOString();

    const jobs: PublishJobRecord[] = [];
    for (const t of targets) {
      const existingJobs = await this.repository.findByTargetId(t.id);
      if (existingJobs.length > 0) {
        continue;
      }

      let job: PublishJobRecord;
      try {
        job = await this.repository.create({
          id: randomUUID(),
          campaignTargetId: t.id,
          status: 'queued',
          attempt: 1,
          progressPercent: 0,
          youtubeVideoId: null,
          errorMessage: null,
          startedAt: null,
          completedAt: null,
          createdAt: nowIso,
        });
      } catch (error) {
        if (this.isDuplicateTargetJobError(error)) {
          continue;
        }
        throw error;
      }

      jobs.push(job);
    }
    return jobs;
  }

  async pickNext(): Promise<PublishJobRecord | null> {
    const job = await this.repository.findNextQueued();
    if (!job) return null;

    return await this.repository.update(job.id, {
      status: 'processing',
      startedAt: this.now().toISOString(),
    });
  }

  async markCompleted(jobId: string, youtubeVideoId: string): Promise<PublishJobRecord | null> {
    return await this.repository.update(jobId, {
      status: 'completed',
      youtubeVideoId,
      completedAt: this.now().toISOString(),
    });
  }

  async markFailed(jobId: string, errorMessage: string, youtubeVideoId?: string): Promise<PublishJobRecord | null> {
    return await this.repository.update(jobId, {
      status: 'failed',
      errorMessage,
      youtubeVideoId: typeof youtubeVideoId === 'string' && youtubeVideoId.trim() ? youtubeVideoId.trim() : null,
    });
  }

  async retry(jobId: string): Promise<PublishJobRecord | { error: 'MAX_ATTEMPTS_REACHED' | 'NOT_FOUND' | 'INVALID_STATUS' }> {
    const job = await this.repository.findById(jobId);
    if (!job) return { error: 'NOT_FOUND' };
    if (job.status !== 'failed') return { error: 'INVALID_STATUS' };

    if (job.attempt >= this.maxAttempts) {
      return { error: 'MAX_ATTEMPTS_REACHED' };
    }

    return (await this.repository.update(jobId, {
      status: 'queued',
      attempt: job.attempt + 1,
      errorMessage: null,
      youtubeVideoId: null,
      startedAt: null,
      completedAt: null,
    }))!;
  }

  async getJobsForTarget(targetId: string): Promise<PublishJobRecord[]> {
    return await this.repository.findByTargetId(targetId);
  }

  async getAllJobs(): Promise<PublishJobRecord[]> {
    return await this.repository.findAll();
  }
}
