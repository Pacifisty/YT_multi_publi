import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScheduledRefreshJob } from '../../apps/api/src/auth/scheduled-refresh-job';
import type { TokenRefreshService, RefreshAllResult } from '../../apps/api/src/auth/token-refresh.service';

function makeRefreshResult(overrides: Partial<RefreshAllResult> = {}): RefreshAllResult {
  return {
    checked: 3,
    refreshed: 2,
    failed: 0,
    skipped: 1,
    errors: [],
    ...overrides,
  };
}

function createMockRefreshService(result?: RefreshAllResult): TokenRefreshService {
  return {
    refreshAll: vi.fn().mockResolvedValue(result ?? makeRefreshResult()),
    refreshOne: vi.fn(),
  } as unknown as TokenRefreshService;
}

describe('ScheduledRefreshJob', () => {
  let job: ScheduledRefreshJob;
  let refreshService: TokenRefreshService;

  beforeEach(() => {
    vi.useFakeTimers();
    refreshService = createMockRefreshService();
  });

  afterEach(() => {
    job?.stop();
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('creates with default interval of 4 minutes', () => {
      job = new ScheduledRefreshJob({ refreshService });
      expect(job.intervalMs).toBe(4 * 60_000);
    });

    it('accepts custom interval', () => {
      job = new ScheduledRefreshJob({ refreshService, intervalMs: 60_000 });
      expect(job.intervalMs).toBe(60_000);
    });
  });

  describe('start / stop', () => {
    it('starts running and sets isRunning to true', () => {
      job = new ScheduledRefreshJob({ refreshService });
      job.start();
      expect(job.isRunning).toBe(true);
    });

    it('stop sets isRunning to false', () => {
      job = new ScheduledRefreshJob({ refreshService });
      job.start();
      job.stop();
      expect(job.isRunning).toBe(false);
    });

    it('does not double-start', () => {
      job = new ScheduledRefreshJob({ refreshService });
      job.start();
      job.start(); // second call should be no-op
      expect(job.isRunning).toBe(true);
    });

    it('stop is safe to call when not running', () => {
      job = new ScheduledRefreshJob({ refreshService });
      expect(() => job.stop()).not.toThrow();
    });
  });

  describe('scheduled execution', () => {
    it('calls refreshAll on each interval tick', async () => {
      job = new ScheduledRefreshJob({ refreshService, intervalMs: 10_000 });
      job.start();

      await vi.advanceTimersByTimeAsync(10_000);
      expect(refreshService.refreshAll).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(10_000);
      expect(refreshService.refreshAll).toHaveBeenCalledTimes(2);
    });

    it('does not call refreshAll before first interval', () => {
      job = new ScheduledRefreshJob({ refreshService, intervalMs: 10_000 });
      job.start();

      expect(refreshService.refreshAll).not.toHaveBeenCalled();
    });

    it('stops calling refreshAll after stop()', async () => {
      job = new ScheduledRefreshJob({ refreshService, intervalMs: 10_000 });
      job.start();

      await vi.advanceTimersByTimeAsync(10_000);
      expect(refreshService.refreshAll).toHaveBeenCalledTimes(1);

      job.stop();
      await vi.advanceTimersByTimeAsync(30_000);
      expect(refreshService.refreshAll).toHaveBeenCalledTimes(1);
    });
  });

  describe('run history', () => {
    it('records each run result', async () => {
      job = new ScheduledRefreshJob({ refreshService, intervalMs: 10_000 });
      job.start();

      await vi.advanceTimersByTimeAsync(10_000);
      await vi.advanceTimersByTimeAsync(10_000);

      const history = job.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].result.refreshed).toBe(2);
      expect(history[1].result.refreshed).toBe(2);
    });

    it('records timestamp for each run', async () => {
      const baseTime = new Date('2025-06-01T12:00:00Z').getTime();
      vi.setSystemTime(baseTime);

      job = new ScheduledRefreshJob({ refreshService, intervalMs: 60_000 });
      job.start();

      await vi.advanceTimersByTimeAsync(60_000);

      const history = job.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].ranAt).toBeDefined();
    });

    it('limits history to maxHistory entries', async () => {
      job = new ScheduledRefreshJob({
        refreshService,
        intervalMs: 1_000,
        maxHistory: 3,
      });
      job.start();

      for (let i = 0; i < 5; i++) {
        await vi.advanceTimersByTimeAsync(1_000);
      }

      const history = job.getHistory();
      expect(history).toHaveLength(3);
    });
  });

  describe('error handling', () => {
    it('records error when refreshAll throws', async () => {
      const failingService = {
        refreshAll: vi.fn().mockRejectedValue(new Error('Network error')),
        refreshOne: vi.fn(),
      } as unknown as TokenRefreshService;

      job = new ScheduledRefreshJob({ refreshService: failingService, intervalMs: 5_000 });
      job.start();

      await vi.advanceTimersByTimeAsync(5_000);

      const history = job.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].error).toBe('Network error');
      expect(history[0].result).toBeNull();
    });

    it('continues running after an error', async () => {
      const failingOnce = {
        refreshAll: vi.fn()
          .mockRejectedValueOnce(new Error('Transient'))
          .mockResolvedValue(makeRefreshResult()),
        refreshOne: vi.fn(),
      } as unknown as TokenRefreshService;

      job = new ScheduledRefreshJob({ refreshService: failingOnce, intervalMs: 5_000 });
      job.start();

      await vi.advanceTimersByTimeAsync(5_000);
      await vi.advanceTimersByTimeAsync(5_000);

      const history = job.getHistory();
      expect(history).toHaveLength(2);
      expect(history[0].error).toBe('Transient');
      expect(history[1].result).not.toBeNull();
      expect(history[1].error).toBeUndefined();
    });
  });

  describe('runOnce', () => {
    it('executes a single refresh without starting the scheduler', async () => {
      job = new ScheduledRefreshJob({ refreshService });

      const result = await job.runOnce();
      expect(result.refreshed).toBe(2);
      expect(refreshService.refreshAll).toHaveBeenCalledTimes(1);
      expect(job.isRunning).toBe(false);
    });

    it('records the run in history', async () => {
      job = new ScheduledRefreshJob({ refreshService });
      await job.runOnce();

      const history = job.getHistory();
      expect(history).toHaveLength(1);
    });
  });

  describe('onRun callback', () => {
    it('calls onRun after each scheduled execution', async () => {
      const onRun = vi.fn();
      job = new ScheduledRefreshJob({ refreshService, intervalMs: 5_000, onRun });
      job.start();

      await vi.advanceTimersByTimeAsync(5_000);

      expect(onRun).toHaveBeenCalledTimes(1);
      expect(onRun).toHaveBeenCalledWith(
        expect.objectContaining({ result: expect.objectContaining({ refreshed: 2 }) }),
      );
    });

    it('calls onRun with error entry on failure', async () => {
      const onRun = vi.fn();
      const failingService = {
        refreshAll: vi.fn().mockRejectedValue(new Error('Boom')),
        refreshOne: vi.fn(),
      } as unknown as TokenRefreshService;

      job = new ScheduledRefreshJob({ refreshService: failingService, intervalMs: 5_000, onRun });
      job.start();

      await vi.advanceTimersByTimeAsync(5_000);

      expect(onRun).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Boom', result: null }),
      );
    });
  });
});
