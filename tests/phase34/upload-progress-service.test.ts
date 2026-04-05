import { describe, it, expect, vi } from 'vitest';
import { UploadProgressService } from '../../apps/api/src/campaigns/upload-progress.service';
import type { UploadProgressEntry, AggregateProgress } from '../../apps/api/src/campaigns/upload-progress.service';

describe('UploadProgressService', () => {
  const fixedDate = new Date('2025-06-01T12:00:00Z');
  const laterDate = new Date('2025-06-01T12:00:10Z');

  function createService(overrides: {
    updateJob?: (jobId: string, progressPercent: number) => void;
    now?: () => Date;
  } = {}) {
    return new UploadProgressService({
      now: overrides.now ?? (() => fixedDate),
      updateJob: overrides.updateJob,
    });
  }

  describe('startTracking', () => {
    it('initializes entry with zero progress', () => {
      const service = createService();
      const entry = service.startTracking('job-1', 1000000);

      expect(entry).toEqual({
        jobId: 'job-1',
        bytesUploaded: 0,
        totalBytes: 1000000,
        percent: 0,
        bytesPerSecond: 0,
        startedAt: fixedDate.toISOString(),
        updatedAt: fixedDate.toISOString(),
        status: 'uploading',
      });
    });

    it('resets tracking if job already tracked', () => {
      const service = createService();
      service.startTracking('job-1', 500);
      service.updateProgress('job-1', 250);

      const entry = service.startTracking('job-1', 1000);
      expect(entry.bytesUploaded).toBe(0);
      expect(entry.totalBytes).toBe(1000);
      expect(entry.percent).toBe(0);
    });
  });

  describe('updateProgress', () => {
    it('updates bytes and percent', () => {
      const service = createService();
      service.startTracking('job-1', 1000);

      const entry = service.updateProgress('job-1', 500);
      expect(entry).not.toBeNull();
      expect(entry!.bytesUploaded).toBe(500);
      expect(entry!.percent).toBe(50);
    });

    it('returns null for unknown job', () => {
      const service = createService();
      const entry = service.updateProgress('unknown', 100);
      expect(entry).toBeNull();
    });

    it('calculates speed in bytes per second', () => {
      let currentDate = fixedDate;
      const service = createService({
        now: () => currentDate,
      });

      service.startTracking('job-1', 10000);
      currentDate = laterDate; // 10 seconds later
      const entry = service.updateProgress('job-1', 5000);

      expect(entry!.bytesPerSecond).toBe(500); // 5000 bytes / 10 seconds
    });

    it('clamps percent to 100', () => {
      const service = createService();
      service.startTracking('job-1', 100);

      const entry = service.updateProgress('job-1', 200);
      expect(entry!.percent).toBe(100);
    });

    it('calls updateJob callback with progress percent', () => {
      const updateJob = vi.fn();
      const service = createService({ updateJob });
      service.startTracking('job-1', 1000);

      service.updateProgress('job-1', 250);
      expect(updateJob).toHaveBeenCalledWith('job-1', 25);
    });
  });

  describe('getProgress', () => {
    it('returns null for unknown job', () => {
      const service = createService();
      expect(service.getProgress('unknown')).toBeNull();
    });

    it('returns current entry', () => {
      const service = createService();
      service.startTracking('job-1', 2000);
      service.updateProgress('job-1', 1000);

      const entry = service.getProgress('job-1');
      expect(entry).not.toBeNull();
      expect(entry!.jobId).toBe('job-1');
      expect(entry!.percent).toBe(50);
      expect(entry!.status).toBe('uploading');
    });
  });

  describe('markCompleted', () => {
    it('sets status to completed and percent to 100', () => {
      const service = createService();
      service.startTracking('job-1', 1000);
      service.updateProgress('job-1', 800);

      const entry = service.markCompleted('job-1');
      expect(entry).not.toBeNull();
      expect(entry!.status).toBe('completed');
      expect(entry!.percent).toBe(100);
      expect(entry!.bytesUploaded).toBe(1000);
    });

    it('returns null for unknown job', () => {
      const service = createService();
      expect(service.markCompleted('unknown')).toBeNull();
    });
  });

  describe('markFailed', () => {
    it('sets status to failed', () => {
      const service = createService();
      service.startTracking('job-1', 1000);
      service.updateProgress('job-1', 300);

      const entry = service.markFailed('job-1');
      expect(entry).not.toBeNull();
      expect(entry!.status).toBe('failed');
      expect(entry!.percent).toBe(30);
    });

    it('returns null for unknown job', () => {
      const service = createService();
      expect(service.markFailed('unknown')).toBeNull();
    });
  });

  describe('getAggregateProgress', () => {
    it('aggregates progress across multiple jobs', () => {
      const service = createService();
      service.startTracking('job-1', 1000);
      service.startTracking('job-2', 2000);
      service.startTracking('job-3', 3000);

      service.updateProgress('job-1', 500);
      service.updateProgress('job-2', 2000);
      service.markCompleted('job-2');
      service.markFailed('job-3');

      const agg = service.getAggregateProgress(['job-1', 'job-2', 'job-3']);
      expect(agg).toEqual({
        totalBytes: 6000,
        uploadedBytes: 2500,
        percent: 42,
        activeUploads: 1,
        completedUploads: 1,
        failedUploads: 1,
      });
    });

    it('returns zeroes for empty array', () => {
      const service = createService();
      const agg = service.getAggregateProgress([]);
      expect(agg).toEqual({
        totalBytes: 0,
        uploadedBytes: 0,
        percent: 0,
        activeUploads: 0,
        completedUploads: 0,
        failedUploads: 0,
      });
    });

    it('skips unknown job ids', () => {
      const service = createService();
      service.startTracking('job-1', 1000);
      service.updateProgress('job-1', 500);

      const agg = service.getAggregateProgress(['job-1', 'unknown-job']);
      expect(agg.totalBytes).toBe(1000);
      expect(agg.uploadedBytes).toBe(500);
      expect(agg.percent).toBe(50);
    });
  });

  describe('createProgressCallback', () => {
    it('returns a function that updates progress', () => {
      const service = createService();
      service.startTracking('job-1', 1000);

      const callback = service.createProgressCallback('job-1');
      expect(typeof callback).toBe('function');

      callback(400);

      const entry = service.getProgress('job-1');
      expect(entry!.bytesUploaded).toBe(400);
      expect(entry!.percent).toBe(40);
    });

    it('callback invokes updateJob on each call', () => {
      const updateJob = vi.fn();
      const service = createService({ updateJob });
      service.startTracking('job-1', 200);

      const callback = service.createProgressCallback('job-1');
      callback(100);
      callback(200);

      expect(updateJob).toHaveBeenCalledTimes(2);
      expect(updateJob).toHaveBeenCalledWith('job-1', 50);
      expect(updateJob).toHaveBeenCalledWith('job-1', 100);
    });
  });
});
