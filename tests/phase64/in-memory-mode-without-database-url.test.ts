import { afterEach, describe, expect, test } from 'vitest';
import { bootstrap } from '../../apps/api/src/bootstrap';
import { loadEnvConfig, validateEnvConfig } from '../../apps/api/src/config/env.config';

const baseEnv: Record<string, string | undefined> = {
  NODE_ENV: 'test',
  SESSION_SECRET: 'test-session-secret-32-chars-min!!',
  OAUTH_TOKEN_KEY: '12345678901234567890123456789012',
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/callback',
  ADMIN_EMAIL: 'admin@test.com',
  ADMIN_PASSWORD_HASH: '$2b$10$fakehash',
};

describe('in-memory mode without DATABASE_URL', () => {
  let cleanup: (() => Promise<void>) | null = null;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = null;
    }
  });

  test('env validation allows DATABASE_URL to be omitted', () => {
    const config = loadEnvConfig(baseEnv);
    const errors = validateEnvConfig(config);

    expect(errors.find((e) => e.field === 'DATABASE_URL')).toBeUndefined();
  });

  test('bootstrap succeeds and reports in-memory mode when DATABASE_URL is missing', () => {
    const result = bootstrap({ env: baseEnv });

    const health = result.healthCheck.handleRequest();
    const ready = result.healthCheck.handleReadyRequest();

    expect(health.status).toBe(200);
    expect(health.body.database).toEqual({
      configured: false,
      connected: false,
      mode: 'in-memory',
    });
    expect(ready.status).toBe(200);
    expect(ready.body.ready).toBe(true);
  });

  test('startServer serves /health and /ready in in-memory mode without DATABASE_URL', async () => {
    const { startServer } = await import('../../apps/api/src/start');

    const instance = await startServer({ env: baseEnv, port: 0 });
    cleanup = instance.shutdown;

    const healthResponse = await fetch(`http://127.0.0.1:${instance.port}/health`);
    const healthBody = await healthResponse.json();
    const readyResponse = await fetch(`http://127.0.0.1:${instance.port}/ready`);
    const readyBody = await readyResponse.json();

    expect(healthResponse.status).toBe(200);
    expect(healthBody.database.mode).toBe('in-memory');
    expect(healthBody.database.configured).toBe(false);
    expect(readyResponse.status).toBe(200);
    expect(readyBody.ready).toBe(true);
  });
});
