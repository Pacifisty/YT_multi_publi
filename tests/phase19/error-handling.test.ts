import { describe, it, expect } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createErrorHandler } from '../../apps/api/src/middleware/error-handler';

function createMockReq(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  return { method: 'GET', url: '/', headers: {}, ...overrides } as IncomingMessage;
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

describe('Error Handling Middleware', () => {
  it('passes through when handler succeeds', async () => {
    const handler = createErrorHandler({ nodeEnv: 'production' });
    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res, async () => {
      res.setHeader('content-type', 'application/json');
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true }));
    });

    expect(res._status).toBe(200);
    expect(JSON.parse(res._body)).toEqual({ ok: true });
  });

  it('catches thrown Error and returns 500 JSON response', async () => {
    const handler = createErrorHandler({ nodeEnv: 'production' });
    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res, async () => {
      throw new Error('Something went wrong');
    });

    expect(res._status).toBe(500);
    const body = JSON.parse(res._body);
    expect(body.error).toBe('Internal Server Error');
    expect(body.message).toBe('Something went wrong');
  });

  it('hides stack trace in production', async () => {
    const handler = createErrorHandler({ nodeEnv: 'production' });
    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res, async () => {
      throw new Error('secret details');
    });

    const body = JSON.parse(res._body);
    expect(body.stack).toBeUndefined();
  });

  it('includes stack trace in development', async () => {
    const handler = createErrorHandler({ nodeEnv: 'development' });
    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res, async () => {
      throw new Error('dev error');
    });

    const body = JSON.parse(res._body);
    expect(body.stack).toBeDefined();
    expect(body.stack).toContain('dev error');
  });

  it('handles errors with custom statusCode property', async () => {
    const handler = createErrorHandler({ nodeEnv: 'production' });
    const req = createMockReq();
    const res = createMockRes();

    const err = new Error('Not found') as Error & { statusCode: number };
    err.statusCode = 404;

    await handler(req, res, async () => {
      throw err;
    });

    expect(res._status).toBe(404);
    const body = JSON.parse(res._body);
    expect(body.error).toBe('Not Found');
    expect(body.message).toBe('Not found');
  });

  it('handles non-Error thrown values', async () => {
    const handler = createErrorHandler({ nodeEnv: 'production' });
    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res, async () => {
      throw 'string error';
    });

    expect(res._status).toBe(500);
    const body = JSON.parse(res._body);
    expect(body.error).toBe('Internal Server Error');
    expect(body.message).toBe('An unexpected error occurred');
  });

  it('handles errors with status property (alternative to statusCode)', async () => {
    const handler = createErrorHandler({ nodeEnv: 'production' });
    const req = createMockReq();
    const res = createMockRes();

    const err = new Error('Forbidden') as Error & { status: number };
    err.status = 403;

    await handler(req, res, async () => {
      throw err;
    });

    expect(res._status).toBe(403);
    const body = JSON.parse(res._body);
    expect(body.error).toBe('Forbidden');
  });

  it('sets content-type to application/json', async () => {
    const handler = createErrorHandler({ nodeEnv: 'production' });
    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res, async () => {
      throw new Error('test');
    });

    expect(res._headers['content-type']).toBe('application/json');
  });

  it('handles 400-level status codes', async () => {
    const handler = createErrorHandler({ nodeEnv: 'production' });
    const req = createMockReq();
    const res = createMockRes();

    const err = new Error('Bad request data') as Error & { statusCode: number };
    err.statusCode = 400;

    await handler(req, res, async () => {
      throw err;
    });

    expect(res._status).toBe(400);
    const body = JSON.parse(res._body);
    expect(body.error).toBe('Bad Request');
    expect(body.message).toBe('Bad request data');
  });

  it('clamps status codes to valid HTTP range', async () => {
    const handler = createErrorHandler({ nodeEnv: 'production' });
    const req = createMockReq();
    const res = createMockRes();

    const err = new Error('weird') as Error & { statusCode: number };
    err.statusCode = 999;

    await handler(req, res, async () => {
      throw err;
    });

    expect(res._status).toBe(500);
  });

  it('defaults to development behavior when nodeEnv is not set', async () => {
    const handler = createErrorHandler({});
    const req = createMockReq();
    const res = createMockRes();

    await handler(req, res, async () => {
      throw new Error('fallback');
    });

    const body = JSON.parse(res._body);
    expect(body.stack).toBeDefined();
  });
});
