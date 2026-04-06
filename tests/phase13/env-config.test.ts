import { describe, expect, test } from 'vitest';

import {
  loadEnvConfig,
  validateEnvConfig,
  type EnvConfig,
  type EnvValidationError,
} from '../../apps/api/src/config/env.config';

describe('Environment config — loadEnvConfig', () => {
  const validEnv: Record<string, string> = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/mydb',
    GOOGLE_CLIENT_ID: 'google-client-id',
    GOOGLE_CLIENT_SECRET: 'google-client-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:3000/auth/callback',
    OAUTH_TOKEN_KEY: 'a]3Fk9$2mP!xL7nQ&vR4wY6zA0cE8gI5',
    ADMIN_EMAIL: 'admin@example.com',
    ADMIN_PASSWORD_HASH: 'sha256:abc123',
    PORT: '3000',
    NODE_ENV: 'development',
  };

  test('loads all required fields from env object', () => {
    const config = loadEnvConfig(validEnv);

    expect(config.databaseUrl).toBe('postgresql://user:pass@localhost:5432/mydb');
    expect(config.googleClientId).toBe('google-client-id');
    expect(config.googleClientSecret).toBe('google-client-secret');
    expect(config.googleRedirectUri).toBe('http://localhost:3000/auth/callback');
    expect(config.oauthTokenKey).toBe('a]3Fk9$2mP!xL7nQ&vR4wY6zA0cE8gI5');
    expect(config.adminEmail).toBe('admin@example.com');
    expect(config.adminPasswordHash).toBe('sha256:abc123');
    expect(config.port).toBe(3000);
    expect(config.nodeEnv).toBe('development');
  });

  test('defaults PORT to 3000 when not provided', () => {
    const env = { ...validEnv };
    delete (env as any).PORT;

    const config = loadEnvConfig(env);

    expect(config.port).toBe(3000);
  });

  test('defaults NODE_ENV to development when not provided', () => {
    const env = { ...validEnv };
    delete (env as any).NODE_ENV;

    const config = loadEnvConfig(env);

    expect(config.nodeEnv).toBe('development');
  });

  test('parses PORT as integer', () => {
    const env = { ...validEnv, PORT: '8080' };

    const config = loadEnvConfig(env);

    expect(config.port).toBe(8080);
  });

  test('handles missing optional fields with undefined', () => {
    const env = { ...validEnv };
    delete (env as any).DATABASE_URL;
    delete (env as any).GOOGLE_CLIENT_ID;

    const config = loadEnvConfig(env);

    expect(config.databaseUrl).toBeUndefined();
    expect(config.googleClientId).toBeUndefined();
  });
});

describe('Environment config — validateEnvConfig', () => {
  const validConfig: EnvConfig = {
    databaseUrl: 'postgresql://user:pass@localhost:5432/mydb',
    googleClientId: 'google-client-id',
    googleClientSecret: 'google-client-secret',
    googleRedirectUri: 'http://localhost:3000/auth/callback',
    oauthTokenKey: 'a]3Fk9$2mP!xL7nQ&vR4wY6zA0cE8gI5',
    adminEmail: 'admin@example.com',
    adminPasswordHash: 'sha256:abc123',
    port: 3000,
    nodeEnv: 'development',
  };

  test('returns no errors for valid config', () => {
    const errors = validateEnvConfig(validConfig);

    expect(errors).toEqual([]);
  });

  test('allows missing DATABASE_URL in development for in-memory mode', () => {
    const config = { ...validConfig, databaseUrl: undefined, nodeEnv: 'development' };

    const errors = validateEnvConfig(config as any);

    expect(errors.find((e) => e.field === 'DATABASE_URL')).toBeUndefined();
  });

  test('returns error for missing DATABASE_URL in production', () => {
    const config = { ...validConfig, databaseUrl: undefined, nodeEnv: 'production' };

    const errors = validateEnvConfig(config as any);

    expect(errors).toContainEqual(
      expect.objectContaining({ field: 'DATABASE_URL', message: expect.stringContaining('production') }),
    );
  });

  test('returns error for missing GOOGLE_CLIENT_ID', () => {
    const config = { ...validConfig, googleClientId: undefined };

    const errors = validateEnvConfig(config as any);

    expect(errors).toContainEqual(
      expect.objectContaining({ field: 'GOOGLE_CLIENT_ID' }),
    );
  });

  test('returns error for missing GOOGLE_CLIENT_SECRET', () => {
    const config = { ...validConfig, googleClientSecret: undefined };

    const errors = validateEnvConfig(config as any);

    expect(errors).toContainEqual(
      expect.objectContaining({ field: 'GOOGLE_CLIENT_SECRET' }),
    );
  });

  test('returns error for missing GOOGLE_REDIRECT_URI', () => {
    const config = { ...validConfig, googleRedirectUri: undefined };

    const errors = validateEnvConfig(config as any);

    expect(errors).toContainEqual(
      expect.objectContaining({ field: 'GOOGLE_REDIRECT_URI' }),
    );
  });

  test('returns error for missing OAUTH_TOKEN_KEY', () => {
    const config = { ...validConfig, oauthTokenKey: undefined };

    const errors = validateEnvConfig(config as any);

    expect(errors).toContainEqual(
      expect.objectContaining({ field: 'OAUTH_TOKEN_KEY' }),
    );
  });

  test('returns error for OAUTH_TOKEN_KEY with wrong length', () => {
    const config = { ...validConfig, oauthTokenKey: 'too-short' };

    const errors = validateEnvConfig(config as any);

    expect(errors).toContainEqual(
      expect.objectContaining({ field: 'OAUTH_TOKEN_KEY', message: expect.stringContaining('32') }),
    );
  });

  test('returns error for missing ADMIN_EMAIL', () => {
    const config = { ...validConfig, adminEmail: undefined };

    const errors = validateEnvConfig(config as any);

    expect(errors).toContainEqual(
      expect.objectContaining({ field: 'ADMIN_EMAIL' }),
    );
  });

  test('returns error for missing ADMIN_PASSWORD_HASH', () => {
    const config = { ...validConfig, adminPasswordHash: undefined };

    const errors = validateEnvConfig(config as any);

    expect(errors).toContainEqual(
      expect.objectContaining({ field: 'ADMIN_PASSWORD_HASH' }),
    );
  });

  test('returns error for invalid PORT (NaN)', () => {
    const config = { ...validConfig, port: NaN };

    const errors = validateEnvConfig(config);

    expect(errors).toContainEqual(
      expect.objectContaining({ field: 'PORT', message: expect.stringContaining('valid') }),
    );
  });

  test('returns error for PORT out of range', () => {
    const config = { ...validConfig, port: 99999 };

    const errors = validateEnvConfig(config);

    expect(errors).toContainEqual(
      expect.objectContaining({ field: 'PORT', message: expect.stringContaining('range') }),
    );
  });

  test('returns error for invalid NODE_ENV', () => {
    const config = { ...validConfig, nodeEnv: 'staging' };

    const errors = validateEnvConfig(config);

    expect(errors).toContainEqual(
      expect.objectContaining({ field: 'NODE_ENV', message: expect.stringContaining('development') }),
    );
  });

  test('accumulates multiple errors', () => {
    const config = {
      ...validConfig,
      databaseUrl: undefined,
      googleClientId: undefined,
      oauthTokenKey: undefined,
      adminEmail: undefined,
      nodeEnv: 'production',
    };

    const errors = validateEnvConfig(config as any);

    expect(errors.length).toBeGreaterThanOrEqual(4);
  });

  test('accepts production as valid NODE_ENV', () => {
    const config = { ...validConfig, nodeEnv: 'production' };

    const errors = validateEnvConfig(config);

    const nodeEnvErrors = errors.filter(e => e.field === 'NODE_ENV');
    expect(nodeEnvErrors).toHaveLength(0);
  });

  test('accepts test as valid NODE_ENV', () => {
    const config = { ...validConfig, nodeEnv: 'test' };

    const errors = validateEnvConfig(config);

    const nodeEnvErrors = errors.filter(e => e.field === 'NODE_ENV');
    expect(nodeEnvErrors).toHaveLength(0);
  });
});
