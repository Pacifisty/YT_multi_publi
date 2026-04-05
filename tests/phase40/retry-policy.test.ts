import { describe, it, expect } from 'vitest';
import { RetryPolicy, type RetryPolicyOptions } from '../../apps/api/src/campaigns/retry-policy';

function createPolicy(overrides: Partial<RetryPolicyOptions> = {}): RetryPolicy {
  return new RetryPolicy({
    maxRetries: overrides.maxRetries ?? 3,
    baseDelayMs: overrides.baseDelayMs ?? 100,
    backoffMultiplier: overrides.backoffMultiplier ?? 2,
    _delayFn: overrides._delayFn ?? (async () => {}),
    ...overrides,
  });
}

describe('RetryPolicy', () => {
  it('returns result on first attempt success', async () => {
    const policy = createPolicy();
    const result = await policy.execute(() => Promise.resolve('ok'));
    expect(result.result).toBe('ok');
    expect(result.attempts).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it('retries after transient failure and returns success', async () => {
    const policy = createPolicy({ maxRetries: 3 });
    let calls = 0;
    const result = await policy.execute(() => {
      calls++;
      if (calls < 3) throw new Error(`fail-${calls}`);
      return Promise.resolve('recovered');
    });
    expect(result.result).toBe('recovered');
    expect(result.attempts).toBe(3);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].message).toBe('fail-1');
    expect(result.errors[1].message).toBe('fail-2');
  });

  it('fails after exhausting all retries', async () => {
    const policy = createPolicy({ maxRetries: 2 });
    const result = await policy.execute(() => {
      throw new Error('always fails');
    });
    expect(result.result).toBeNull();
    expect(result.attempts).toBe(3); // 1 initial + 2 retries
    expect(result.errors).toHaveLength(3);
    expect(result.success).toBe(false);
  });

  it('success flag is true on success', async () => {
    const policy = createPolicy();
    const result = await policy.execute(() => Promise.resolve(42));
    expect(result.success).toBe(true);
  });

  it('applies exponential backoff delays', async () => {
    const delays: number[] = [];
    const policy = createPolicy({
      maxRetries: 3,
      baseDelayMs: 100,
      backoffMultiplier: 2,
      _delayFn: async (ms: number) => { delays.push(ms); },
    });
    await policy.execute(() => { throw new Error('fail'); });
    // delay before retry 1: 100ms, retry 2: 200ms, retry 3: 400ms
    expect(delays).toEqual([100, 200, 400]);
  });

  it('uses custom backoff multiplier', async () => {
    const delays: number[] = [];
    const policy = createPolicy({
      maxRetries: 3,
      baseDelayMs: 50,
      backoffMultiplier: 3,
      _delayFn: async (ms: number) => { delays.push(ms); },
    });
    await policy.execute(() => { throw new Error('fail'); });
    expect(delays).toEqual([50, 150, 450]);
  });

  it('does not delay on first attempt', async () => {
    const delays: number[] = [];
    const policy = createPolicy({
      _delayFn: async (ms: number) => { delays.push(ms); },
    });
    await policy.execute(() => Promise.resolve('ok'));
    expect(delays).toEqual([]);
  });

  it('calls onRetry callback before each retry', async () => {
    const retries: Array<{ attempt: number; error: string }> = [];
    const policy = createPolicy({
      maxRetries: 2,
      onRetry: (attempt, error) => {
        retries.push({ attempt, error: error.message });
      },
    });
    let calls = 0;
    await policy.execute(() => {
      calls++;
      if (calls <= 2) throw new Error(`err-${calls}`);
      return Promise.resolve('done');
    });
    expect(retries).toEqual([
      { attempt: 2, error: 'err-1' },
      { attempt: 3, error: 'err-2' },
    ]);
  });

  it('handles zero retries — fails immediately', async () => {
    const policy = createPolicy({ maxRetries: 0 });
    const result = await policy.execute(() => { throw new Error('nope'); });
    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(result.errors).toHaveLength(1);
  });

  it('handles async operations that reject', async () => {
    const policy = createPolicy({ maxRetries: 1 });
    let calls = 0;
    const result = await policy.execute(async () => {
      calls++;
      if (calls === 1) return Promise.reject(new Error('rejected'));
      return 'ok';
    });
    expect(result.success).toBe(true);
    expect(result.result).toBe('ok');
    expect(result.attempts).toBe(2);
  });

  it('preserves error types in errors array', async () => {
    const policy = createPolicy({ maxRetries: 1 });
    const customError = new TypeError('type error');
    let calls = 0;
    const result = await policy.execute(() => {
      calls++;
      if (calls === 1) throw customError;
      return Promise.resolve('ok');
    });
    expect(result.errors[0]).toBe(customError);
    expect(result.errors[0]).toBeInstanceOf(TypeError);
  });

  it('wraps non-Error throws in Error objects', async () => {
    const policy = createPolicy({ maxRetries: 0 });
    const result = await policy.execute(() => {
      throw 'string error'; // eslint-disable-line no-throw-literal
    });
    expect(result.errors[0]).toBeInstanceOf(Error);
    expect(result.errors[0].message).toBe('string error');
  });

  it('defaults backoffMultiplier to 2 when not specified', async () => {
    const delays: number[] = [];
    const policy = new RetryPolicy({
      maxRetries: 2,
      baseDelayMs: 100,
      _delayFn: async (ms: number) => { delays.push(ms); },
    });
    await policy.execute(() => { throw new Error('fail'); });
    expect(delays).toEqual([100, 200]);
  });
});
