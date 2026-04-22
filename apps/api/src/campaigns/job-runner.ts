import type { PublishJobRecord } from './publish-job.service';
import type { PlatformDispatchWorker } from './platform-dispatch.worker';

export interface JobRunnerOptions {
  worker: PlatformDispatchWorker;
}

export class JobRunner {
  private readonly worker: PlatformDispatchWorker;

  constructor(options: JobRunnerOptions) {
    this.worker = options.worker;
  }

  /**
   * Process all queued jobs until the queue is empty.
   * Returns an array of all processed job results.
   */
  async processAll(): Promise<PublishJobRecord[]> {
    const results: PublishJobRecord[] = [];

    while (true) {
      const result = await this.worker.processNext();
      if (!result) break;
      results.push(result);
    }

    return results;
  }
}
