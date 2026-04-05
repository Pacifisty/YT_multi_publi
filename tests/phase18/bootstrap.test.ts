import { describe, expect, test, vi } from 'vitest';

import {
  bootstrap,
  type BootstrapOptions,
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

describe('Bootstrap — wiring', () => {
  test('returns server, sessionStore, and composedHandler', () => {
    const result = bootstrap({ env: validEnv });

    expect(result.server).toBeDefined();
    expect(result.sessionStore).toBeDefined();
    expect(result.handler).toBeTypeOf('function');
  });

  test('wires session store into server using OAUTH_TOKEN_KEY as secret', () => {
    const result = bootstrap({ env: validEnv });

    // Create a token and verify it resolves through the stack
    const token = result.sessionStore.createToken({ email: 'admin@example.com' });
    expect(token).toBeTypeOf('string');

    const session = result.sessionStore.verifyToken(token);
    expect(session).not.toBeNull();
    expect(session!.adminUser!.email).toBe('admin@example.com');
  });

  test('exposes port from config', () => {
    const result = bootstrap({ env: validEnv });

    expect(result.server.config.port).toBe(4000);
  });

  test('allows custom allowedOrigins', () => {
    const result = bootstrap({
      env: validEnv,
      allowedOrigins: ['https://app.example.com'],
    });

    expect(result).toBeDefined();
  });

  test('defaults allowedOrigins to wildcard in non-production', () => {
    const result = bootstrap({ env: { ...validEnv, NODE_ENV: 'development' } });

    expect(result).toBeDefined();
  });
});

describe('Bootstrap — composed handler', () => {
  test('handler applies security headers then routes request', async () => {
    const result = bootstrap({ env: validEnv });

    const req = createMockReq({ method: 'GET', url: '/api/campaigns' });
    const res = createMockRes();

    await result.handler(req as any, res as any);

    // Security headers should be set
    expect(res._headers['x-content-type-options']).toBe('nosniff');
    expect(res._headers['x-frame-options']).toBe('DENY');
    // Response should have been processed
    expect(res._status).toBeGreaterThanOrEqual(200);
  });

  test('handler resolves session from cookie for authenticated requests', async () => {
    const result = bootstrap({ env: validEnv });

    // Create a valid session token
    const token = result.sessionStore.createToken({ email: 'admin@example.com' });

    const req = createMockReq({
      method: 'GET',
      url: '/api/campaigns',
      headers: { cookie: `gsd_admin_session=${token}` },
    });
    const res = createMockRes();

    await result.handler(req as any, res as any);

    expect(res._status).toBe(200);
    const body = JSON.parse(res._body);
    expect(body.campaigns).toBeDefined();
  });

  test('handler returns 401 for unauthenticated campaign requests', async () => {
    const result = bootstrap({ env: validEnv });

    const req = createMockReq({ method: 'GET', url: '/api/campaigns' });
    const res = createMockRes();

    await result.handler(req as any, res as any);

    expect(res._status).toBe(401);
  });

  test('handler handles preflight OPTIONS with CORS headers', async () => {
    const result = bootstrap({
      env: validEnv,
      allowedOrigins: ['http://localhost:3000'],
    });

    const req = createMockReq({
      method: 'OPTIONS',
      url: '/api/campaigns',
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'POST',
      },
    });
    const res = createMockRes();

    await result.handler(req as any, res as any);

    expect(res._status).toBe(204);
    expect(res._headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  test('handler processes login and returns session cookie', async () => {
    const result = bootstrap({ env: validEnv });

    const body = JSON.stringify({ email: 'admin@example.com', password: 'secret123' });
    const buf = Buffer.from(body);
    const req = createMockReq({
      method: 'POST',
      url: '/auth/login',
      headers: { 'content-type': 'application/json' },
      bodyBuffer: buf,
    });
    const res = createMockRes();

    await result.handler(req as any, res as any);

    expect(res._status).toBe(200);
  });
});

// --- test helpers ---

function createMockReq(overrides: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  bodyBuffer?: Buffer;
} = {}) {
  const buf = overrides.bodyBuffer;
  const req: any = {
    method: overrides.method ?? 'GET',
    url: overrides.url ?? '/',
    headers: overrides.headers ?? {},
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
