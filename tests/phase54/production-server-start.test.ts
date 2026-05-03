import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import http from 'node:http';

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

function withoutDatabaseUrl(env: Record<string, string>): Record<string, string> {
  const { DATABASE_URL: _databaseUrl, ...rest } = env;
  return rest;
}

// ── startServer function ─────────────────────────────────────────────────────

describe('startServer', () => {
  let cleanup: (() => Promise<void>) | null = null;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = null;
    }
  });

  test('exports startServer function', async () => {
    const mod = await import('../../apps/api/src/start');
    expect(typeof mod.startServer).toBe('function');
  });

  test('starts HTTP server on specified port and responds to /health', async () => {
    const { startServer } = await import('../../apps/api/src/start');

    const instance = await startServer({
      env: withoutDatabaseUrl(baseEnv),
      port: 0,
    });
    cleanup = instance.shutdown;

    const port = instance.port;
    expect(port).toBeGreaterThan(0);

    // HTTP request to /health
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
  });

  test('connects database when _prismaFactory is provided', async () => {
    const { startServer } = await import('../../apps/api/src/start');

    const connectFn = vi.fn().mockResolvedValue(undefined);
    const disconnectFn = vi.fn().mockResolvedValue(undefined);
    const fakePrisma = { $connect: connectFn, $disconnect: disconnectFn };

    const instance = await startServer({
      env: { ...baseEnv, DATABASE_URL: 'postgresql://localhost/test' },
      _prismaFactory: () => fakePrisma,
      port: 0,
    });
    cleanup = instance.shutdown;

    expect(connectFn).toHaveBeenCalledOnce();
    const paymentService = (instance.bootstrapResult.server.app.accountPlanController as any).paymentService;
    expect(paymentService.webhookDeduplicator).toBeDefined();
  });

  test('shutdown closes HTTP server and disconnects database', async () => {
    const { startServer } = await import('../../apps/api/src/start');

    const connectFn = vi.fn().mockResolvedValue(undefined);
    const disconnectFn = vi.fn().mockResolvedValue(undefined);
    const fakePrisma = { $connect: connectFn, $disconnect: disconnectFn };

    const instance = await startServer({
      env: { ...baseEnv, DATABASE_URL: 'postgresql://localhost/test' },
      _prismaFactory: () => fakePrisma,
      port: 0,
    });

    const port = instance.port;
    await instance.shutdown();
    cleanup = null; // already shut down

    expect(disconnectFn).toHaveBeenCalledOnce();

    // Server should no longer accept connections
    await expect(
      fetch(`http://127.0.0.1:${port}/health`).then((r) => r.json()),
    ).rejects.toThrow();
  });

  test('works without DATABASE_URL (in-memory mode)', async () => {
    const { startServer } = await import('../../apps/api/src/start');

    const instance = await startServer({ env: withoutDatabaseUrl(baseEnv), port: 0 });
    cleanup = instance.shutdown;

    const port = instance.port;
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    expect(response.status).toBe(200);
  });

  test('returns bootstrapResult with databaseProvider', async () => {
    const { startServer } = await import('../../apps/api/src/start');

    const instance = await startServer({ env: withoutDatabaseUrl(baseEnv), port: 0 });
    cleanup = instance.shutdown;

    expect(instance.bootstrapResult).toBeDefined();
    expect(instance.bootstrapResult.server).toBeDefined();
    expect(instance.bootstrapResult.databaseProvider).toBeDefined();
  });

  test('API routes respond through HTTP — GET /api/dashboard returns 401 without auth', async () => {
    const { startServer } = await import('../../apps/api/src/start');

    const instance = await startServer({ env: withoutDatabaseUrl(baseEnv), port: 0 });
    cleanup = instance.shutdown;

    const response = await fetch(`http://127.0.0.1:${instance.port}/api/dashboard`);
    expect(response.status).toBe(401);
  });
});
