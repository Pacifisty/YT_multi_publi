import { unlink } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, test, vi } from 'vitest';

import { createRequestHandler } from '../src/http-adapter';
import type { AppInstance } from '../src/app';

function request(method: string, url: string, body: Buffer, contentType = 'application/json'): IncomingMessage {
  const req: any = {
    method,
    url,
    headers: { cookie: 'session=test', 'content-type': contentType, 'content-length': String(body.byteLength) },
    on(event: string, callback: (chunk?: Buffer) => void) {
      if (event === 'data' && body.byteLength) callback(body);
      if (event === 'end') callback();
      return req;
    },
    destroy: vi.fn(),
  };
  return req;
}

function response(): ServerResponse & { status: number; body: string } {
  const res: any = {
    status: 0,
    body: '',
    headers: {},
    setHeader(name: string, value: unknown) { res.headers[name.toLowerCase()] = value; },
    writeHead(status: number) { res.status = status; return res; },
    end(body?: string) { res.body = body ?? ''; },
  };
  return res;
}

function app(): AppInstance {
  return {
    handleRequest: vi.fn(async (req: any) => {
      if (req.path === '/api/media' && req.body?.video?.filePath) {
        await unlink(req.body.video.filePath).catch(() => {});
        return { status: 201, body: { asset: { id: 'asset-1', size_bytes: req.body.video.sizeBytes } } };
      }
      return { status: 404, body: { error: 'not found' } };
    }),
    authModule: {} as any,
    campaignsModule: {} as any,
    accountsModule: {} as any,
    mediaModule: { mediaService: {} } as any,
    router: {} as any,
    backgroundProcessor: null,
    accountPlanService: {} as any,
    accountPlanController: {} as any,
  };
}

describe('chunked media upload through HTTP adapter', () => {
  test('initializes, stores, assembles and forwards a video', async () => {
    const mockApp = app();
    const handler = createRequestHandler({
      app: mockApp,
      sessionResolver: () => ({ adminUser: { email: 'owner@example.com' } } as any),
    });

    const initRes = response();
    await handler(request('POST', '/api/media/chunked/init', Buffer.from(JSON.stringify({
      originalName: 'sample.mp4',
      mimeType: 'video/mp4',
      totalSize: 4,
      durationSeconds: 2,
    }))), initRes);
    expect(initRes.status).toBe(201);
    const init = JSON.parse(initRes.body);
    expect(init.totalChunks).toBe(1);

    const chunkRes = response();
    await handler(request('PUT', `/api/media/chunked/${init.uploadId}/0`, Buffer.from('test'), 'application/octet-stream'), chunkRes);
    expect(chunkRes.status).toBe(200);

    const completeRes = response();
    await handler(request('POST', `/api/media/chunked/${init.uploadId}/complete`, Buffer.from('{}')), completeRes);
    expect(completeRes.status).toBe(201);
    expect(JSON.parse(completeRes.body).asset.size_bytes).toBe(4);
    expect(mockApp.handleRequest).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST',
      path: '/api/media',
      body: expect.objectContaining({
        video: expect.objectContaining({ originalName: 'sample.mp4', sizeBytes: 4 }),
      }),
    }));
  });

  test('requires an authenticated session before initializing', async () => {
    const handler = createRequestHandler({ app: app(), sessionResolver: () => null });
    const res = response();
    await handler(request('POST', '/api/media/chunked/init', Buffer.from('{}')), res);
    expect(res.status).toBe(401);
  });
});
