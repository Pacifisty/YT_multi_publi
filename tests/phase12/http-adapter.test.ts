import { describe, expect, test, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';

import {
  createRequestHandler,
  type RequestHandlerOptions,
} from '../../apps/api/src/http-adapter';
import type { AppInstance, HttpRequest, HttpResponse } from '../../apps/api/src/app';

function mockApp(response: Partial<HttpResponse> = {}): AppInstance {
  return {
    handleRequest: vi.fn().mockResolvedValue({
      status: 200,
      body: { ok: true },
      ...response,
    }),
    authModule: {} as any,
    campaignsModule: {} as any,
    router: {} as any,
  };
}

function mockReq(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  const chunks: Buffer[] = [];
  const req: any = {
    method: 'GET',
    url: '/api/campaigns',
    headers: {},
    on(event: string, cb: Function) {
      if (event === 'data') {
        for (const chunk of chunks) cb(chunk);
      }
      if (event === 'end') cb();
      return req;
    },
    ...overrides,
  };
  return req as IncomingMessage;
}

function mockReqWithBody(body: unknown, overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  const json = JSON.stringify(body);
  const buf = Buffer.from(json);
  const req: any = {
    method: 'POST',
    url: '/api/campaigns',
    headers: { 'content-type': 'application/json' },
    on(event: string, cb: Function) {
      if (event === 'data') cb(buf);
      if (event === 'end') cb();
      return req;
    },
    ...overrides,
  };
  return req as IncomingMessage;
}

function mockRes(): ServerResponse & { _status: number; _headers: Record<string, string | string[]>; _body: string } {
  const res: any = {
    _status: 0,
    _headers: {} as Record<string, string | string[]>,
    _body: '',
    writeHead(status: number, headers?: Record<string, string | string[]>) {
      res._status = status;
      if (headers) Object.assign(res._headers, headers);
      return res;
    },
    setHeader(name: string, value: string | string[]) {
      res._headers[name.toLowerCase()] = value;
      return res;
    },
    end(body?: string) {
      if (body) res._body = body;
    },
  };
  return res;
}

describe('HTTP adapter — createRequestHandler', () => {
  test('returns a function', () => {
    const handler = createRequestHandler({ app: mockApp() });
    expect(handler).toBeTypeOf('function');
  });

  test('translates GET request and returns JSON response', async () => {
    const app = mockApp({ status: 200, body: { campaigns: [] } });
    const handler = createRequestHandler({ app });
    const req = mockReq({ method: 'GET', url: '/api/campaigns' });
    const res = mockRes();

    await handler(req, res as any);

    expect(app.handleRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/api/campaigns', session: null }),
    );
    expect(res._status).toBe(200);
    expect(JSON.parse(res._body)).toEqual({ campaigns: [] });
  });

  test('parses JSON body for POST requests', async () => {
    const app = mockApp();
    const handler = createRequestHandler({ app });
    const req = mockReqWithBody({ title: 'My Campaign' }, { method: 'POST', url: '/api/campaigns' });
    const res = mockRes();

    await handler(req, res as any);

    expect(app.handleRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'POST', body: { title: 'My Campaign' } }),
    );
  });

  test('passes null session when no sessionResolver provided', async () => {
    const app = mockApp();
    const handler = createRequestHandler({ app });
    const req = mockReq({ headers: { cookie: 'session=abc123' } });
    const res = mockRes();

    await handler(req, res as any);

    expect(app.handleRequest).toHaveBeenCalledWith(
      expect.objectContaining({ session: null }),
    );
  });

  test('uses sessionResolver to resolve session from cookie header', async () => {
    const app = mockApp();
    const session = { adminUser: { email: 'admin@test.com' } };
    const sessionResolver = vi.fn().mockReturnValue(session);
    const handler = createRequestHandler({ app, sessionResolver });
    const req = mockReq({ headers: { cookie: 'session=abc123' } });
    const res = mockRes();

    await handler(req, res as any);

    expect(sessionResolver).toHaveBeenCalledWith('session=abc123');
    expect(app.handleRequest).toHaveBeenCalledWith(
      expect.objectContaining({ session }),
    );
  });

  test('sets Set-Cookie headers from response cookies', async () => {
    const app = mockApp({
      status: 200,
      body: { ok: true },
      cookies: [
        { name: 'session', value: 'tok123', options: { httpOnly: true, path: '/' } },
      ],
    });
    const handler = createRequestHandler({ app });
    const req = mockReq({ method: 'POST', url: '/auth/login' });
    const res = mockRes();

    await handler(req, res as any);

    expect(res._headers['set-cookie']).toBeDefined();
    const cookies = res._headers['set-cookie'];
    const cookieStr = Array.isArray(cookies) ? cookies[0] : cookies;
    expect(cookieStr).toContain('session=tok123');
    expect(cookieStr).toContain('HttpOnly');
    expect(cookieStr).toContain('Path=/');
  });

  test('returns 400 for invalid JSON body', async () => {
    const app = mockApp();
    const handler = createRequestHandler({ app });
    const invalidJson = 'not-json{{{';
    const buf = Buffer.from(invalidJson);
    const req: any = {
      method: 'POST',
      url: '/api/campaigns',
      headers: { 'content-type': 'application/json' },
      on(event: string, cb: Function) {
        if (event === 'data') cb(buf);
        if (event === 'end') cb();
        return req;
      },
    };
    const res = mockRes();

    await handler(req as IncomingMessage, res as any);

    expect(res._status).toBe(400);
    expect(JSON.parse(res._body)).toEqual({ error: 'Invalid JSON body' });
  });

  test('handles request with no body for GET', async () => {
    const app = mockApp();
    const handler = createRequestHandler({ app });
    const req = mockReq({ method: 'GET', url: '/api/dashboard' });
    const res = mockRes();

    await handler(req, res as any);

    expect(app.handleRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', path: '/api/dashboard', body: undefined }),
    );
  });

  test('sets Content-Type header to application/json', async () => {
    const app = mockApp();
    const handler = createRequestHandler({ app });
    const req = mockReq();
    const res = mockRes();

    await handler(req, res as any);

    expect(res._headers['content-type']).toBe('application/json');
  });

  test('strips query string from URL path', async () => {
    const app = mockApp();
    const handler = createRequestHandler({ app });
    const req = mockReq({ url: '/api/campaigns?page=1&limit=10' });
    const res = mockRes();

    await handler(req, res as any);

    expect(app.handleRequest).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/api/campaigns' }),
    );
  });

  test('handles PATCH method with body', async () => {
    const app = mockApp();
    const handler = createRequestHandler({ app });
    const req = mockReqWithBody({ title: 'Updated' }, { method: 'PATCH', url: '/api/campaigns/abc' });
    const res = mockRes();

    await handler(req, res as any);

    expect(app.handleRequest).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'PATCH', path: '/api/campaigns/abc', body: { title: 'Updated' } }),
    );
  });
});

describe('HTTP adapter — cookie serialization', () => {
  test('serializes multiple cookies', async () => {
    const app = mockApp({
      status: 200,
      body: {},
      cookies: [
        { name: 'a', value: '1', options: {} },
        { name: 'b', value: '2', options: { httpOnly: true } },
      ],
    });
    const handler = createRequestHandler({ app });
    const req = mockReq();
    const res = mockRes();

    await handler(req, res as any);

    const cookies = res._headers['set-cookie'];
    expect(Array.isArray(cookies)).toBe(true);
    expect((cookies as string[]).length).toBe(2);
  });

  test('serializes cookie with SameSite and Secure flags', async () => {
    const app = mockApp({
      status: 200,
      body: {},
      cookies: [
        { name: 'session', value: 'tok', options: { sameSite: 'Strict', secure: true } },
      ],
    });
    const handler = createRequestHandler({ app });
    const req = mockReq();
    const res = mockRes();

    await handler(req, res as any);

    const cookies = res._headers['set-cookie'];
    const cookieStr = Array.isArray(cookies) ? cookies[0] : cookies;
    expect(cookieStr).toContain('SameSite=Strict');
    expect(cookieStr).toContain('Secure');
  });

  test('serializes cookie with maxAge', async () => {
    const app = mockApp({
      status: 200,
      body: {},
      cookies: [
        { name: 'session', value: 'tok', options: { maxAge: 3600 } },
      ],
    });
    const handler = createRequestHandler({ app });
    const req = mockReq();
    const res = mockRes();

    await handler(req, res as any);

    const cookies = res._headers['set-cookie'];
    const cookieStr = Array.isArray(cookies) ? cookies[0] : cookies;
    expect(cookieStr).toContain('Max-Age=3600');
  });
});
