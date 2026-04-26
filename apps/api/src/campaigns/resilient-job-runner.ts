import type { PublishJobRecord } from './publish-job.service';

export interface ResilientJobRunnerOptions {
  processNext: () => Promise<PublishJobRecord | null>;
  retryJob: (jobId: string) => Promise<PublishJobRecord | { error: string }> | PublishJobRecord | { error: string };
  maxRetries?: number;
  baseDelayMs?: number;
  backoffMultiplier?: number;
  onRetry?: (jobId: string, attempt: number) => void;
  _delayFn?: (ms: number) => Promise<void>;
}

export interface RunSummary {
  totalProcessed: number;
  succeeded: number;
  failed: number;
  totalRetries: number;
  results: PublishJobRecord[];
}

export class ResilientJobRunner {
  private readonly processNext: () => Promise<PublishJobRecord | null>;
  private readonly retryJob: (jobId: string) => Promise<PublishJobRecord | { error: string }> | PublishJobRecord | { error: string };
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly backoffMultiplier: number;
  private readonly onRetry?: (jobId: string, attempt: number) => void;
  private readonly delayFn: (ms: number) => Promise<void>;

  constructor(options: ResilientJobRunnerOptions) {
    this.processNext = options.processNext;
    this.retryJob = options.retryJob;
    this.maxRetries = options.maxRetries ?? 2;
    this.baseDelayMs = options.baseDelayMs ?? 100;
    this.backoffMultiplier = options.backoffMultiplier ?? 2;
    this.onRetry = options.onRetry;
    this.delayFn =
      options._delayFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  async processAll(): Promise<PublishJobRecord[]> {
    const summary = await this.processAllWithSummary();
    return summary.results;
  }

  async processAllWithSummary(): Promise<RunSummary> {
    const results: PublishJobRecord[] = [];
    let totalRetries = 0;
    let succeeded = 0;
    let failed = 0;

    while (true) {
      const result = await this.processNext();
      if (!result) break;

      if (result.status === 'failed') {
        const finalResult = await this.retryWithBackoff(result);
        totalRetries += finalResult.retries;
        results.push(finalResult.job);
        if (finalResult.job.status === 'failed') {
          failed++;
        } else {
          succeeded++;
        }
      } else {
        results.push(result);
        succeeded++;
      }
    }

    return {
      totalProcessed: results.length,
      succeeded,
      failed,
      totalRetries,
      results,
    };
  }

  private async retryWithBackoff(
    failedJob: PublishJobRecord,
  ): Promise<{ job: PublishJobRecord; retries: number }> {
    let currentJob = failedJob;
    let retries = 0;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const retryResult = await this.retryJob(currentJob.id);
      if ('error' in retryResult) {
        break;
      }

      retries++;
      const delayMs =
        this.baseDelayMs * Math.pow(this.backoffMultiplier, attempt);
      await this.delayFn(delayMs);
      this.onRetry?.(currentJob.id, attempt + 2);

      const nextResult = await this.processNext();
      if (!nextResult) break;

      if (nextResult.status !== 'failed') {
        return { job: nextResult, retries };
      }
      currentJob = nextResult;
    }

    return { job: currentJob, retries };
  }
}
