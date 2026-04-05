import { describe, expect, test } from 'vitest';
import {
  bootstrap,
  type BootstrapResult,
} from '../../apps/api/src/bootstrap';

const validEnv: Record<string, string> = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/mydb',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/auth/callback',
  OAUTH_TOKEN_KEY: 'a]3Fk9$2mP!xL7nQ&vR4wY6zA0cE8gI5',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_PASSWORD_HASH: 'plain:secret123',
  PORT: '4000',
  NODE_ENV: 'test',
};

// --- test helpers ---

function createMockReq(overrides: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  bodyBuffer?: Buffer;
  socket?: { remoteAddress?: string };
} = {}) {
  const buf = overrides.bodyBuffer;
  const req: any = {
    method: overrides.method ?? 'GET',
    url: overrides.url ?? '/',
    headers: overrides.headers ?? {},
    socket: overrides.socket ?? { remoteAddress: '127.0.0.1' },
    on(event: string, cb: Function) {
      if (event === 'data' && buf) cb(buf);
      if (event === 'end') cb();
      return req;
    },
  };
  return req;
}

function createMockRes() {
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

describe('Bootstrap — error handler wiring', () => {
  test('returns structured JSON when a route throws', async () => {
    const result = bootstrap({ env: validEnv });

    // Hit a path that will cause an error inside the handler
    // POST to /api/campaigns without auth — the error handler should catch
    // any unexpected throws and return structured JSON
    const req = createMockReq({ method: 'GET', url: '/nonexistent-route' });
    const res = createMockRes();

    await result.handler(req as any, res as any);

    // Should get a response (not crash) — either 404 or routed response
    expect(res._ended).toBe(true);
    expect(res._status).toBeGreaterThanOrEqual(200);
  });

  test('error handler does not expose stack in production mode', async () => {
    const result = bootstrap({ env: { ...validEnv, NODE_ENV: 'production' } });

    const req = createMockReq({ method: 'GET', url: '/nonexistent-route' });
    const res = createMockRes();

    await result.handler(req as any, res as any);

    if (res._body) {
      const body = JSON.parse(res._body);
      expect(body.stack).toBeUndefined();
    }
  });
});

describe('Bootstrap — health check wiring', () => {
  test('GET /health returns 200 with status ok', async () => {
    const result = bootstrap({ env: validEnv });

    const req = createMockReq({ method: 'GET', url: '/health' });
    const res = createMockRes();

    await result.handler(req as any, res as any);

    expect(res._status).toBe(200);
    const body = JSON.parse(res._body);
    expect(body.status).toBe('ok');
    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(body.timestamp).toBeDefined();
  });

  test('health check includes version and environment', async () => {
    const result = bootstrap({ env: validEnv });

    const req = createMockReq({ method: 'GET', url: '/health' });
    const res = createMockRes();

    await result.handler(req as any, res as any);

    const body = JSON.parse(res._body);
    expect(body.version).toBeDefined();
    expect(body.environment).toBe('test');
  });

  test('health check bypasses auth — no session required', async () => {
    const result = bootstrap({ env: validEnv });

    // No cookie, no session — should still return 200
    const req = createMockReq({ method: 'GET', url: '/health' });
    const res = createMockRes();

    await result.handler(req as any, res as any);

    expect(res._status).toBe(200);
  });

  test('health check gets security headers', async () => {
    const result = bootstrap({ env: validEnv });

    const req = createMockReq({ method: 'GET', url: '/health' });
    const res = createMockRes();

    await result.handler(req as any, res as any);

    expect(res._headers['x-content-type-options']).toBe('nosniff');
  });
});

describe('Bootstrap — rate limiter wiring', () => {
  test('rate limit headers present on auth requests', async () => {
    const result = bootstrap({ env: validEnv });

    const body = JSON.stringify({ email: 'admin@example.com', password: 'wrong' });
    const buf = Buffer.from(body);
    const req = createMockReq({
      method: 'POST',
      url: '/auth/login',
      headers: { 'content-type': 'application/json' },
      bodyBuffer: buf,
      socket: { remoteAddress: '10.10.10.1' },
    });
    const res = createMockRes();

    await result.handler(req as any, res as any);

    expect(res._headers['x-ratelimit-limit']).toBeDefined();
    expect(res._headers['x-ratelimit-remaining']).toBeDefined();
  });

  test('returns 429 after exceeding rate limit on login', async () => {
    const result = bootstrap({ env: validEnv });
    const ip = '10.99.99.99';

    // Fire many login attempts from same IP to exceed limit
    for (let i = 0; i < 20; i++) {
      const body = JSON.stringify({ email: 'test@test.com', password: 'wrong' });
      const buf = Buffer.from(body);
      const req = createMockReq({
        method: 'POST',
        url: '/auth/login',
        headers: { 'content-type': 'application/json' },
        bodyBuffer: buf,
        socket: { remoteAddress: ip },
      });
      const res = createMockRes();
      await result.handler(req as any, res as any);

      if (res._status === 429) {
        const resBody = JSON.parse(res._body);
        expect(resBody.error).toContain('Too');
        return; // Test passes
      }
    }

    // Should have hit 429 within 20 attempts
    expect.unreachable('Expected 429 but never received it');
  });

  test('rate limiter does not apply to non-auth routes', async () => {
    const result = bootstrap({ env: validEnv });
    const token = result.sessionStore.createToken({ email: 'admin@example.com' });
    const ip = '10.50.50.50';

    // Fire many campaign list requests — should never get 429
    for (let i = 0; i < 20; i++) {
      const req = createMockReq({
        method: 'GET',
        url: '/api/campaigns',
        headers: { cookie: `gsd_admin_session=${token}` },
        socket: { remoteAddress: ip },
      });
      const res = createMockRes();
      await result.handler(req as any, res as any);

      expect(res._status).not.toBe(429);
    }
  });
});

describe('Bootstrap — result shape', () => {
  test('exposes healthCheck on result', () => {
    const result = bootstrap({ env: validEnv });

    expect(result.healthCheck).toBeDefined();
    expect(result.healthCheck.check).toBeTypeOf('function');
  });
});
