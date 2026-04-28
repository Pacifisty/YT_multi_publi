import { describe, expect, test } from 'vitest';
import {
  classifyPublishError,
  classifyPublishErrorMessage,
} from '../../apps/api/src/campaigns/error-classifier';
import {
  PublishJobService,
  InMemoryPublishJobRepository,
} from '../../apps/api/src/campaigns/publish-job.service';

describe('classifyPublishError', () => {
  test.each([
    ['quotaExceeded', 'permanent'],
    ['quota exceeded', 'permanent'],
    ['Target not found', 'permanent'],
    ['Campaign not found', 'permanent'],
    ['YouTube target is missing channelId', 'permanent'],
    ['Invalid request: title too long', 'permanent'],
    ['Unauthorized', 'permanent'],
    ['Forbidden', 'permanent'],
    ['HTTP 401', 'permanent'],
    ['HTTP 403', 'permanent'],
    ['HTTP 404', 'permanent'],
    ['videoTooLong', 'permanent'],
    ['videoNotFound', 'permanent'],
    ['validation failed', 'permanent'],
    ['malformed payload', 'permanent'],
  ])('classifies %s as permanent', (msg, expected) => {
    expect(classifyPublishErrorMessage(msg)).toBe(expected);
    expect(classifyPublishError(new Error(msg))).toBe(expected);
  });

  test.each([
    'connection reset',
    'ECONNRESET',
    'socket hang up',
    'timeout',
    'temporary server error',
    'Internal server error',
    '500',
    '503',
  ])('classifies "%s" as transient', (msg) => {
    expect(classifyPublishErrorMessage(msg)).toBe('transient');
  });

  test('null/undefined messages classify as transient (safe default)', () => {
    expect(classifyPublishErrorMessage(null)).toBe('transient');
    expect(classifyPublishErrorMessage(undefined)).toBe('transient');
    expect(classifyPublishErrorMessage('')).toBe('transient');
  });

  test('extracts message from Error objects, plain strings, and unknown payloads', () => {
    expect(classifyPublishError(new Error('quotaExceeded'))).toBe('permanent');
    expect(classifyPublishError('quotaExceeded')).toBe('permanent');
    expect(classifyPublishError({ message: 'quotaExceeded' })).toBe('permanent');
    expect(classifyPublishError({ code: 500 })).toBe('transient');
  });
});

describe('PublishJobService.retry — errorClass gating', () => {
  test('returns NON_RETRIABLE when errorClass is permanent', async () => {
    const repo = new InMemoryPublishJobRepository();
    const service = new PublishJobService({ repository: repo });

    await service.enqueueForTargets([{ id: 't1', campaignId: 'c1' }]);
    const job = repo.findAll()[0];

    await service.markFailed(job.id, 'quotaExceeded', { errorClass: 'permanent' });

    const result = await service.retry(job.id);
    expect(result).toEqual({ error: 'NON_RETRIABLE' });

    // Job remains failed, attempt did not increment
    const after = repo.findById(job.id)!;
    expect(after.status).toBe('failed');
    expect(after.attempt).toBe(1);
    expect(after.errorClass).toBe('permanent');
  });

  test('re-queues when errorClass is transient', async () => {
    const repo = new InMemoryPublishJobRepository();
    const service = new PublishJobService({ repository: repo });

    await service.enqueueForTargets([{ id: 't2', campaignId: 'c1' }]);
    const job = repo.findAll()[0];

    await service.markFailed(job.id, 'connection reset', { errorClass: 'transient' });

    const result = await service.retry(job.id);
    expect('error' in result).toBe(false);

    const after = repo.findById(job.id)!;
    expect(after.status).toBe('queued');
    expect(after.attempt).toBe(2);
    expect(after.errorClass).toBeNull();
    expect(after.errorMessage).toBeNull();
  });

  test('re-queues when errorClass is null (legacy / unclassified)', async () => {
    const repo = new InMemoryPublishJobRepository();
    const service = new PublishJobService({ repository: repo });

    await service.enqueueForTargets([{ id: 't3', campaignId: 'c1' }]);
    const job = repo.findAll()[0];

    await service.markFailed(job.id, 'unknown error');

    const result = await service.retry(job.id);
    expect('error' in result).toBe(false);

    const after = repo.findById(job.id)!;
    expect(after.status).toBe('queued');
    expect(after.attempt).toBe(2);
  });

  test('still respects MAX_ATTEMPTS_REACHED for transient errors', async () => {
    const repo = new InMemoryPublishJobRepository();
    const service = new PublishJobService({ repository: repo, maxAttempts: 2 });

    await service.enqueueForTargets([{ id: 't4', campaignId: 'c1' }]);
    const job = repo.findAll()[0];

    await service.markFailed(job.id, 'connection reset', { errorClass: 'transient' });
    await service.retry(job.id); // attempt 1 -> 2

    await service.markFailed(job.id, 'connection reset', { errorClass: 'transient' });
    const result = await service.retry(job.id);
    expect(result).toEqual({ error: 'MAX_ATTEMPTS_REACHED' });
  });
});
