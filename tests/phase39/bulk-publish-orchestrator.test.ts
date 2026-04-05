import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BulkPublishOrchestrator } from '../../apps/api/src/campaigns/bulk-publish.orchestrator';
import type { BulkLaunchResult, CampaignLaunchEntry } from '../../apps/api/src/campaigns/bulk-publish.orchestrator';

function createMockLaunchFn(results: Record<string, { ok: boolean; error?: string }>) {
  return vi.fn(async (campaignId: string) => {
    const r = results[campaignId];
    if (!r) return { ok: false as const, error: 'NOT_FOUND' };
    if (r.ok) return { ok: true as const };
    return { ok: false as const, error: r.error ?? 'UNKNOWN' };
  });
}

describe('BulkPublishOrchestrator', () => {
  describe('launchAll', () => {
    it('launches all campaigns in sequence', async () => {
      const launchFn = createMockLaunchFn({
        'camp-1': { ok: true },
        'camp-2': { ok: true },
        'camp-3': { ok: true },
      });

      const orchestrator = new BulkPublishOrchestrator({ launchFn });
      const result = await orchestrator.launchAll(['camp-1', 'camp-2', 'camp-3']);

      expect(result.total).toBe(3);
      expect(result.succeeded).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.entries).toHaveLength(3);
      expect(launchFn).toHaveBeenCalledTimes(3);
    });

    it('records failures without stopping', async () => {
      const launchFn = createMockLaunchFn({
        'camp-1': { ok: true },
        'camp-2': { ok: false, error: 'NOT_READY' },
        'camp-3': { ok: true },
      });

      const orchestrator = new BulkPublishOrchestrator({ launchFn });
      const result = await orchestrator.launchAll(['camp-1', 'camp-2', 'camp-3']);

      expect(result.total).toBe(3);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.entries[1].error).toBe('NOT_READY');
      expect(launchFn).toHaveBeenCalledTimes(3);
    });

    it('stops on first failure when abortOnError is true', async () => {
      const launchFn = createMockLaunchFn({
        'camp-1': { ok: true },
        'camp-2': { ok: false, error: 'NOT_READY' },
        'camp-3': { ok: true },
      });

      const orchestrator = new BulkPublishOrchestrator({
        launchFn,
        abortOnError: true,
      });
      const result = await orchestrator.launchAll(['camp-1', 'camp-2', 'camp-3']);

      expect(result.total).toBe(3);
      expect(result.succeeded).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.aborted).toBe(true);
      expect(result.entries).toHaveLength(2);
      expect(launchFn).toHaveBeenCalledTimes(2);
    });

    it('returns empty result for empty campaign list', async () => {
      const launchFn = vi.fn();
      const orchestrator = new BulkPublishOrchestrator({ launchFn });
      const result = await orchestrator.launchAll([]);

      expect(result.total).toBe(0);
      expect(result.succeeded).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.entries).toHaveLength(0);
      expect(launchFn).not.toHaveBeenCalled();
    });

    it('handles launch function throwing an error', async () => {
      const launchFn = vi.fn()
        .mockResolvedValueOnce({ ok: true })
        .mockRejectedValueOnce(new Error('Network failure'))
        .mockResolvedValueOnce({ ok: true });

      const orchestrator = new BulkPublishOrchestrator({ launchFn });
      const result = await orchestrator.launchAll(['camp-1', 'camp-2', 'camp-3']);

      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.entries[1].error).toBe('Network failure');
    });
  });

  describe('rate limiting', () => {
    it('applies delay between launches', async () => {
      const launchFn = createMockLaunchFn({
        'camp-1': { ok: true },
        'camp-2': { ok: true },
      });

      const delay = vi.fn().mockResolvedValue(undefined);
      const orchestrator = new BulkPublishOrchestrator({
        launchFn,
        delayMs: 1000,
        _delayFn: delay,
      });

      await orchestrator.launchAll(['camp-1', 'camp-2']);

      // Delay called once (between camp-1 and camp-2, not after last)
      expect(delay).toHaveBeenCalledTimes(1);
      expect(delay).toHaveBeenCalledWith(1000);
    });

    it('does not delay for single campaign', async () => {
      const launchFn = createMockLaunchFn({ 'camp-1': { ok: true } });
      const delay = vi.fn().mockResolvedValue(undefined);

      const orchestrator = new BulkPublishOrchestrator({
        launchFn,
        delayMs: 5000,
        _delayFn: delay,
      });

      await orchestrator.launchAll(['camp-1']);
      expect(delay).not.toHaveBeenCalled();
    });

    it('skips delay after aborted launch', async () => {
      const launchFn = createMockLaunchFn({
        'camp-1': { ok: false, error: 'FAIL' },
      });
      const delay = vi.fn().mockResolvedValue(undefined);

      const orchestrator = new BulkPublishOrchestrator({
        launchFn,
        delayMs: 1000,
        abortOnError: true,
        _delayFn: delay,
      });

      await orchestrator.launchAll(['camp-1', 'camp-2']);
      expect(delay).not.toHaveBeenCalled();
    });
  });

  describe('onLaunched callback', () => {
    it('calls onLaunched after each campaign', async () => {
      const launchFn = createMockLaunchFn({
        'camp-1': { ok: true },
        'camp-2': { ok: false, error: 'NOT_READY' },
      });
      const onLaunched = vi.fn();

      const orchestrator = new BulkPublishOrchestrator({ launchFn, onLaunched });
      await orchestrator.launchAll(['camp-1', 'camp-2']);

      expect(onLaunched).toHaveBeenCalledTimes(2);
      expect(onLaunched).toHaveBeenCalledWith(
        expect.objectContaining({ campaignId: 'camp-1', ok: true }),
      );
      expect(onLaunched).toHaveBeenCalledWith(
        expect.objectContaining({ campaignId: 'camp-2', ok: false, error: 'NOT_READY' }),
      );
    });
  });

  describe('entry details', () => {
    it('entries contain campaignId, ok, and index', async () => {
      const launchFn = createMockLaunchFn({
        'camp-1': { ok: true },
        'camp-2': { ok: true },
      });

      const orchestrator = new BulkPublishOrchestrator({ launchFn });
      const result = await orchestrator.launchAll(['camp-1', 'camp-2']);

      expect(result.entries[0]).toEqual(
        expect.objectContaining({ campaignId: 'camp-1', ok: true, index: 0 }),
      );
      expect(result.entries[1]).toEqual(
        expect.objectContaining({ campaignId: 'camp-2', ok: true, index: 1 }),
      );
    });

    it('failed entries contain error string', async () => {
      const launchFn = createMockLaunchFn({
        'camp-1': { ok: false, error: 'NOT_FOUND' },
      });

      const orchestrator = new BulkPublishOrchestrator({ launchFn });
      const result = await orchestrator.launchAll(['camp-1']);

      expect(result.entries[0].ok).toBe(false);
      expect(result.entries[0].error).toBe('NOT_FOUND');
    });
  });
});
