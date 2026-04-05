import type { PublishJobRecord } from './publish-job.service';
import type { YouTubeUploadWorker } from './youtube-upload.worker';

export interface JobRunnerOptions {
  worker: YouTubeUploadWorker;
}

export class JobRunner {
  private readonly worker: YouTubeUploadWorker;

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
