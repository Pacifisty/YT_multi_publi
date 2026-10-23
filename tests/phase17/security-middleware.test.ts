import { describe, expect, test, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  createSecurityMiddleware,
  type SecurityMiddlewareOptions,
} from '../../apps/api/src/middleware/security';

function mockReq(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  const req: any = {
    method: 'GET',
    url: '/api/campaigns',
    headers: {},
    on(event: string, cb: Function) {
      if (event === 'end') cb();
      return req;
    },
    ...overrides,
  };
  return req as IncomingMessage;
}

function mockRes(): ServerResponse & { _status: number; _headers: Record<string, string | string[]>; _body: string; _ended: boolean } {
  const res: any = {
    _status: 0,
    _headers: {} as Record<string, string | string[]>,
    _body: '',
    _ended: false,
    writeHead(status: number, headers?: Record<string, string | string[]>) {
      res._status = status;
      if (headers) Object.assign(res._headers, headers);
      return res;
    },
    setHeader(name: string, value: string | string[]) {
      res._headers[name.toLowerCase()] = value;
      return res;
    },
    getHeader(name: string) {
      return res._headers[name.toLowerCase()];
    },
    end(body?: string) {
      res._ended = true;
      if (body) res._body = body;
    },
  };
  return res;
}

describe('Security middleware — CORS', () => {
  test('sets CORS headers for allowed origin', async () => {
    const middleware = createSecurityMiddleware({
      allowedOrigins: ['http://localhost:3000'],
    });
    const next = vi.fn().mockResolvedValue(undefined);
    const req = mockReq({ headers: { origin: 'http://localhost:3000' } });
    const res = mockRes();

    await middleware(req, res as any, next);

    expect(res._headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res._headers['access-control-allow-credentials']).toBe('true');
    expect(next).toHaveBeenCalled();
  });

  test('does not set CORS origin for disallowed origin', async () => {
    const middleware = createSecurityMiddleware({
      allowedOrigins: ['http://localhost:3000'],
    });
    const next = vi.fn().mockResolvedValue(undefined);
    const req = mockReq({ headers: { origin: 'http://evil.com' } });
    const res = mockRes();

    await middleware(req, res as any, next);

    expect(res._headers['access-control-allow-origin']).toBeUndefined();
    expect(res._status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('handles preflight OPTIONS request', async () => {
    const middleware = createSecurityMiddleware({
      allowedOrigins: ['http://localhost:3000'],
    });
    const next = vi.fn();
    const req = mockReq({
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'POST',
      },
    });
    const res = mockRes();

    await middleware(req, res as any, next);

    expect(res._status).toBe(204);
    expect(res._ended).toBe(true);
    expect(res._headers['access-control-allow-methods']).toBeDefined();
    expect(res._headers['access-control-allow-headers']).toBeDefined();
    expect(next).not.toHaveBeenCalled();
  });

  test('allows all origins when wildcard is used', async () => {
    const middleware = createSecurityMiddleware({
      allowedOrigins: ['*'],
    });
    const next = vi.fn().mockResolvedValue(undefined);
    const req = mockReq({ headers: { origin: 'http://any-site.com' } });
    const res = mockRes();

    await middleware(req, res as any, next);

    expect(res._headers['access-control-allow-origin']).toBe('http://any-site.com');
  });

  test('does not set CORS headers when no origin in request', async () => {
    const middleware = createSecurityMiddleware({
      allowedOrigins: ['http://localhost:3000'],
    });
    const next = vi.fn().mockResolvedValue(undefined);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res as any, next);

    expect(res._headers['access-control-allow-origin']).toBeUndefined();
    expect(next).toHaveBeenCalled();
  });
});

describe('Security middleware — security headers', () => {
  test('sets X-Content-Type-Options header', async () => {
    const middleware = createSecurityMiddleware({ allowedOrigins: [] });
    const next = vi.fn().mockResolvedValue(undefined);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res as any, next);

    expect(res._headers['x-content-type-options']).toBe('nosniff');
  });

  test('sets X-Frame-Options header', async () => {
    const middleware = createSecurityMiddleware({ allowedOrigins: [] });
    const next = vi.fn().mockResolvedValue(undefined);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res as any, next);

    expect(res._headers['x-frame-options']).toBe('DENY');
  });

  test('sets X-XSS-Protection header', async () => {
    const middleware = createSecurityMiddleware({ allowedOrigins: [] });
    const next = vi.fn().mockResolvedValue(undefined);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res as any, next);

    expect(res._headers['x-xss-protection']).toBe('0');
  });

  test('sets Strict-Transport-Security header', async () => {
    const middleware = createSecurityMiddleware({ allowedOrigins: [] });
    const next = vi.fn().mockResolvedValue(undefined);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res as any, next);

    expect(res._headers['strict-transport-security']).toContain('max-age=');
  });

  test('sets browser isolation and privacy headers', async () => {
    const middleware = createSecurityMiddleware({ allowedOrigins: [] });
    const next = vi.fn().mockResolvedValue(undefined);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res as any, next);

    expect(res._headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res._headers['referrer-policy']).toBe('no-referrer');
    expect(res._headers['permissions-policy']).toContain('camera=()');
    expect(res._headers['cross-origin-opener-policy']).toBe('same-origin-allow-popups');
  });

  test('removes X-Powered-By by not setting it', async () => {
    const middleware = createSecurityMiddleware({ allowedOrigins: [] });
    const next = vi.fn().mockResolvedValue(undefined);
    const req = mockReq();
    const res = mockRes();

    await middleware(req, res as any, next);

    expect(res._headers['x-powered-by']).toBeUndefined();
  });
});

describe('Security middleware — multiple allowed origins', () => {
  test('allows first matching origin', async () => {
    const middleware = createSecurityMiddleware({
      allowedOrigins: ['http://localhost:3000', 'https://app.example.com'],
    });
    const next = vi.fn().mockResolvedValue(undefined);
    const req = mockReq({ headers: { origin: 'https://app.example.com' } });
    const res = mockRes();

    await middleware(req, res as any, next);

    expect(res._headers['access-control-allow-origin']).toBe('https://app.example.com');
  });

  test('sets Vary: Origin header when origin-specific CORS is used', async () => {
    const middleware = createSecurityMiddleware({
      allowedOrigins: ['http://localhost:3000'],
    });
    const next = vi.fn().mockResolvedValue(undefined);
    const req = mockReq({ headers: { origin: 'http://localhost:3000' } });
    const res = mockRes();

    await middleware(req, res as any, next);

    expect(res._headers['vary']).toBe('Origin');
  });
});

describe('Security middleware — preflight caching', () => {
  test('sets Access-Control-Max-Age on preflight', async () => {
    const middleware = createSecurityMiddleware({
      allowedOrigins: ['http://localhost:3000'],
    });
    const next = vi.fn();
    const req = mockReq({
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'POST',
      },
    });
    const res = mockRes();

    await middleware(req, res as any, next);

    expect(res._headers['access-control-max-age']).toBeDefined();
  });
});
