import { describe, expect, test } from 'vitest';

import { createServer } from '../../apps/api/src/server';
import { type EnvConfig, validateEnvConfig } from '../../apps/api/src/config/env.config';

const validConfig: EnvConfig = {
  databaseUrl: 'postgresql://user:pass@localhost:5432/mydb',
  googleClientId: 'google-client-id',
  googleClientSecret: 'google-client-secret',
  googleRedirectUri: 'http://localhost:3000/auth/callback',
  oauthTokenKey: '12345678901234567890123456789012',
  adminEmail: 'admin@example.com',
  adminPasswordHash: 'plain:secret123',
  port: 3000,
  nodeEnv: 'test',
};

const validEnv: Record<string, string> = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/mydb',
  GOOGLE_CLIENT_ID: 'google-client-id',
  GOOGLE_CLIENT_SECRET: 'google-client-secret',
  GOOGLE_REDIRECT_URI: 'http://localhost:3000/auth/callback',
  OAUTH_TOKEN_KEY: '12345678901234567890123456789012',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_PASSWORD_HASH: 'plain:secret123',
  PORT: '3000',
  NODE_ENV: 'test',
};

describe('OAUTH_TOKEN_KEY validation', () => {
  test('accepts a 64-character hex key that resolves to 32 bytes', () => {
    const config = { ...validConfig, oauthTokenKey: 'a'.repeat(64) };

    const errors = validateEnvConfig(config);

    expect(errors.find((error) => error.field === 'OAUTH_TOKEN_KEY')).toBeUndefined();
  });

  test('rejects a 32-character unicode key that does not resolve to 32 bytes', () => {
    const config = { ...validConfig, oauthTokenKey: 'é'.repeat(32) };

    const errors = validateEnvConfig(config);

    expect(errors).toContainEqual(
      expect.objectContaining({ field: 'OAUTH_TOKEN_KEY', message: expect.stringContaining('32 bytes') }),
    );
  });

  test('createServer accepts a valid hex-encoded OAUTH_TOKEN_KEY', () => {
    expect(() => createServer({ env: { ...validEnv, OAUTH_TOKEN_KEY: 'a'.repeat(64) } })).not.toThrow();
  });
});
