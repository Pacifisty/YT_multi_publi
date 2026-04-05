import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRateLimiter, type RateLimiterOptions } from '../../apps/api/src/middleware/rate-limiter';
import type { IncomingMessage, ServerResponse } from 'node:http';

function createMockReq(overrides: Partial<IncomingMessage> & { socket?: { remoteAddress?: string } } = {}): IncomingMessage {
  const socket = overrides.socket ?? { remoteAddress: '127.0.0.1' };
  return {
    method: 'POST',
    url: '/api/auth/login',
    headers: {},
    socket,
    ...overrides,
  } as unknown as IncomingMessage;
}

function createMockRes(): ServerResponse & {
  _status: number;
  _headers: Record<string, string>;
  _body: string;
} {
  const res = {
    _status: 0,
    _headers: {} as Record<string, string>,
    _body: '',
    setHeader(name: string, value: string) {
      res._headers[name.toLowerCase()] = value;
    },
    writeHead(status: number) {
      res._status = status;
    },
    end(body?: string) {
      res._body = body ?? '';
    },
  } as ServerResponse & { _status: number; _headers: Record<string, string>; _body: string };
  return res;
}

describe('Rate Limiting Middleware', () => {
  const defaultOpts: RateLimiterOptions = {
    windowMs: 60_000,
    maxRequests: 5,
  };

  it('allows requests under the limit', async () => {
    const limiter = createRateLimiter(defaultOpts);
    const req = createMockReq();
    const res = createMockRes();
    let called = false;

    await limiter(req, res, async () => { called = true; });

    expect(called).toBe(true);
  });

  it('blocks requests over the limit with 429', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 2 });
    const req = createMockReq();

    // Exhaust the limit
    for (let i = 0; i < 2; i++) {
      const res = createMockRes();
      await limiter(req, res, async () => {});
    }

    // Next request should be blocked
    const res = createMockRes();
    let called = false;
    await limiter(req, res, async () => { called = true; });

    expect(called).toBe(false);
    expect(res._status).toBe(429);
    const body = JSON.parse(res._body);
    expect(body.error).toBe('Too Many Requests');
  });

  it('tracks requests per IP independently', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1 });

    const req1 = createMockReq({ socket: { remoteAddress: '10.0.0.1' } });
    const req2 = createMockReq({ socket: { remoteAddress: '10.0.0.2' } });

    // IP 1 uses its limit
    await limiter(req1, createMockRes(), async () => {});

    // IP 2 should still be allowed
    const res2 = createMockRes();
    let called = false;
    await limiter(req2, res2, async () => { called = true; });
    expect(called).toBe(true);
  });

  it('resets counts after the window expires', async () => {
    vi.useFakeTimers();

    const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 1 });
    const req = createMockReq();

    // Use the limit
    await limiter(req, createMockRes(), async () => {});

    // Should be blocked
    const res1 = createMockRes();
    let blocked = false;
    await limiter(req, res1, async () => { blocked = true; });
    expect(blocked).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(1100);

    // Should be allowed again
    const res2 = createMockRes();
    let allowed = false;
    await limiter(req, res2, async () => { allowed = true; });
    expect(allowed).toBe(true);

    vi.useRealTimers();
  });

  it('sets Retry-After header when rate limited', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1 });
    const req = createMockReq();

    await limiter(req, createMockRes(), async () => {});

    const res = createMockRes();
    await limiter(req, res, async () => {});

    expect(res._status).toBe(429);
    expect(res._headers['retry-after']).toBeDefined();
    const retryAfter = parseInt(res._headers['retry-after'], 10);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it('sets rate limit info headers on allowed requests', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5 });
    const req = createMockReq();
    const res = createMockRes();

    await limiter(req, res, async () => {});

    expect(res._headers['x-ratelimit-limit']).toBe('5');
    expect(res._headers['x-ratelimit-remaining']).toBe('4');
    expect(res._headers['x-ratelimit-reset']).toBeDefined();
  });

  it('sets content-type to application/json on 429 response', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1 });
    const req = createMockReq();

    await limiter(req, createMockRes(), async () => {});

    const res = createMockRes();
    await limiter(req, res, async () => {});

    expect(res._headers['content-type']).toBe('application/json');
  });

  it('returns retryAfter in the JSON body', async () => {
    const limiter = createRateLimiter({ windowMs: 30_000, maxRequests: 1 });
    const req = createMockReq();

    await limiter(req, createMockRes(), async () => {});

    const res = createMockRes();
    await limiter(req, res, async () => {});

    const body = JSON.parse(res._body);
    expect(body.retryAfter).toBeGreaterThan(0);
  });

  it('handles unknown remote address gracefully', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 2 });
    const req = createMockReq({ socket: { remoteAddress: undefined } });
    const res = createMockRes();
    let called = false;

    await limiter(req, res, async () => { called = true; });

    expect(called).toBe(true);
  });

  it('uses x-forwarded-for header when available', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 1 });

    // Both requests come from same proxy IP but different x-forwarded-for
    const req1 = createMockReq({
      headers: { 'x-forwarded-for': '192.168.1.1' } as Record<string, string>,
      socket: { remoteAddress: '10.0.0.1' },
    });
    const req2 = createMockReq({
      headers: { 'x-forwarded-for': '192.168.1.2' } as Record<string, string>,
      socket: { remoteAddress: '10.0.0.1' },
    });

    // IP 1 uses its limit
    await limiter(req1, createMockRes(), async () => {});

    // IP 2 (different forwarded IP) should still be allowed
    const res2 = createMockRes();
    let called = false;
    await limiter(req2, res2, async () => { called = true; });
    expect(called).toBe(true);
  });

  it('decrements remaining count with each request', async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 3 });
    const req = createMockReq();

    const res1 = createMockRes();
    await limiter(req, res1, async () => {});
    expect(res1._headers['x-ratelimit-remaining']).toBe('2');

    const res2 = createMockRes();
    await limiter(req, res2, async () => {});
    expect(res2._headers['x-ratelimit-remaining']).toBe('1');

    const res3 = createMockRes();
    await limiter(req, res3, async () => {});
    expect(res3._headers['x-ratelimit-remaining']).toBe('0');
  });
});
