import { afterEach, describe, expect, test, vi } from 'vitest';
import { bootstrap } from '../../apps/api/src/bootstrap';
import { createHealthCheck } from '../../apps/api/src/health';

const baseEnv: Record<string, string> = {
  NODE_ENV: 'test',
  SESSION_SECRET: 'test-session-secret-32-chars-min!!',
  OAUTH_TOKEN_KEY: '12345678901234567890123456789012',
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/callback',
  DATABASE_URL: 'postgresql://localhost/test',
  ADMIN_EMAIL: 'admin@test.com',
  ADMIN_PASSWORD_HASH: '$2b$10$fakehash',
};

describe('readiness endpoint', () => {
  let cleanup: (() => Promise<void>) | null = null;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = null;
    }
  });

  test('createHealthCheck reports not ready when database is configured but disconnected', () => {
    const health = createHealthCheck({
      nodeEnv: 'test',
      getDatabaseStatus: () => ({
        configured: true,
        connected: false,
        mode: 'prisma',
      }),
    });

    const response = health.handleReadyRequest();

    expect(response.status).toBe(503);
    expect(response.body.ready).toBe(false);
    expect(response.body.status).toBe('not_ready');
  });

  test('bootstrap exposes /ready and returns 503 before database connection', async () => {
    const result = bootstrap({ env: baseEnv });

    const req = {
      method: 'GET',
      url: '/ready',
      headers: {},
      socket: {},
      on() {},
    } as any;

    const res = createMockResponse();
    await result.handler(req, res as any);

    expect(res.statusCode).toBe(503);
    expect(JSON.parse(res.body).status).toBe('not_ready');
  });

  test('startServer serves /ready as 200 after successful database connect', async () => {
    const { startServer } = await import('../../apps/api/src/start');

    const fakePrisma = {
      $connect: vi.fn().mockResolvedValue(undefined),
      $disconnect: vi.fn().mockResolvedValue(undefined),
      campaign: { create: vi.fn(async ({ data }: any) => data), findUnique: vi.fn(async () => null), findMany: vi.fn(async () => []), update: vi.fn(async () => null), delete: vi.fn(async () => null) },
      campaignTarget: { create: vi.fn(async ({ data }: any) => data), delete: vi.fn(async () => null), update: vi.fn(async () => null) },
      publishJob: { create: vi.fn(async ({ data }: any) => data), findUnique: vi.fn(async () => null), findMany: vi.fn(async () => []), update: vi.fn(async () => null), delete: vi.fn(async () => null) },
      connectedAccount: { create: vi.fn(async ({ data }: any) => data), findUnique: vi.fn(async () => null), findMany: vi.fn(async () => []), update: vi.fn(async () => null), delete: vi.fn(async () => null) },
      youTubeChannel: { create: vi.fn(async ({ data }: any) => data), findUnique: vi.fn(async () => null), findFirst: vi.fn(async () => null), findMany: vi.fn(async () => []), update: vi.fn(async () => null), delete: vi.fn(async () => null) },
      mediaAsset: { create: vi.fn(async ({ data }: any) => data), findUnique: vi.fn(async () => null), findMany: vi.fn(async () => []), update: vi.fn(async () => null), delete: vi.fn(async () => null) },
    };

    const instance = await startServer({
      env: baseEnv,
      port: 0,
      _prismaFactory: () => fakePrisma,
    });
    cleanup = instance.shutdown;

    const response = await fetch(`http://127.0.0.1:${instance.port}/ready`);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ready).toBe(true);
    expect(body.status).toBe('ready');
  });
});

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: '',
    setHeader(name: string, value: string) {
      this.headers[name.toLowerCase()] = value;
    },
    writeHead(status: number) {
      this.statusCode = status;
      return this;
    },
    end(chunk?: string) {
      if (chunk) this.body += chunk;
    },
  };
}
