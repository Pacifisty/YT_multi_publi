import { afterEach, describe, expect, test, vi } from 'vitest';

const baseEnv: Record<string, string> = {
  NODE_ENV: 'test',
  SESSION_SECRET: 'test-session-secret-32-chars-min!!',
  OAUTH_TOKEN_KEY: '12345678901234567890123456789012',
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/callback',
  DATABASE_URL: '',
  ADMIN_EMAIL: 'admin@test.com',
  ADMIN_PASSWORD_HASH: '$2b$10$fakehash',
};

describe('server background processor interval', () => {
  let cleanup: (() => Promise<void>) | null = null;

  afterEach(async () => {
    if (cleanup) {
      await cleanup();
      cleanup = null;
    }
    vi.restoreAllMocks();
  });

  test('continues scheduling campaign processing without depending on page requests', async () => {
    const { startServer } = await import('../../apps/api/src/start');
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    const instance = await startServer({ env: baseEnv, port: 0 });
    cleanup = instance.shutdown;

    const intervalCall = setIntervalSpy.mock.calls.find((call) => call[1] === 15_000);
    expect(intervalCall).toBeDefined();

    const intervalCallback = intervalCall?.[0];
    expect(intervalCallback).toBeTypeOf('function');

    const kickSpy = vi.fn().mockResolvedValue(undefined);
    instance.bootstrapResult.server.app.backgroundProcessor!.kick = kickSpy;

    await intervalCallback?.();

    expect(kickSpy).toHaveBeenCalledOnce();
  });
});
