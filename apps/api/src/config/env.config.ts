import { isValidTokenKey } from '../common/crypto/token-crypto.service';

export interface EnvConfig {
  databaseUrl: string | undefined;
  publicAppUrl: string | undefined;
  googleClientId: string | undefined;
  googleClientSecret: string | undefined;
  googleRedirectUri: string | undefined;
  googleAuthRedirectUri: string | undefined;
  tiktokClientKey: string | undefined;
  tiktokClientSecret: string | undefined;
  tiktokRedirectUri: string | undefined;
  instagramClientId: string | undefined;
  instagramClientSecret: string | undefined;
  instagramRedirectUri: string | undefined;
  oauthTokenKey: string | undefined;
  adminEmail: string | undefined;
  adminPasswordHash: string | undefined;
  mediaStorageRoot: string | undefined;
  port: number;
  nodeEnv: string;
}

export interface EnvValidationError {
  field: string;
  message: string;
}

const VALID_NODE_ENVS = ['development', 'production', 'test'];

function isPlaceholder(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase() ?? '';
  return !normalized
    || normalized === 'replace-me'
    || normalized === 'changeme'
    || normalized === 'change-me'
    || normalized.includes('<set-')
    || normalized.includes('example-secret');
}

function validatePublicHttpsUrl(field: string, value: string | undefined, errors: EnvValidationError[]): void {
  if (!value) {
    errors.push({ field, message: `${field} is required in production` });
    return;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(url.hostname)) {
      errors.push({ field, message: `${field} must be a public HTTPS URL in production` });
    }
  } catch {
    errors.push({ field, message: `${field} must be a valid URL` });
  }
}

function parsePort(rawPort: string | undefined): number {
  if (rawPort === undefined) {
    return 3000;
  }

  const normalized = rawPort.trim();
  if (!/^\d+$/.test(normalized)) {
    return Number.NaN;
  }

  return Number(normalized);
}

export function loadEnvConfig(env: Record<string, string | undefined>): EnvConfig {
  const port = parsePort(env.PORT);

  return {
    databaseUrl: env.DATABASE_URL,
    publicAppUrl: env.PUBLIC_APP_URL,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri: env.GOOGLE_REDIRECT_URI,
    googleAuthRedirectUri: env.GOOGLE_AUTH_REDIRECT_URI,
    tiktokClientKey: env.TIKTOK_CLIENT_KEY,
    tiktokClientSecret: env.TIKTOK_CLIENT_SECRET,
    tiktokRedirectUri: env.TIKTOK_REDIRECT_URI,
    instagramClientId: env.INSTAGRAM_CLIENT_ID,
    instagramClientSecret: env.INSTAGRAM_CLIENT_SECRET,
    instagramRedirectUri: env.INSTAGRAM_REDIRECT_URI,
    oauthTokenKey: env.OAUTH_TOKEN_KEY,
    adminEmail: env.ADMIN_EMAIL,
    adminPasswordHash: env.ADMIN_PASSWORD_HASH,
    mediaStorageRoot: env.MEDIA_STORAGE_ROOT,
    port,
    nodeEnv: env.NODE_ENV ?? 'development',
  };
}

export function validateEnvConfig(config: EnvConfig): EnvValidationError[] {
  const errors: EnvValidationError[] = [];

  if (config.nodeEnv === 'production' && !config.databaseUrl) {
    errors.push({ field: 'DATABASE_URL', message: 'DATABASE_URL is required in production' });
  }

  if (!config.googleClientId) {
    errors.push({ field: 'GOOGLE_CLIENT_ID', message: 'GOOGLE_CLIENT_ID is required' });
  }

  if (!config.googleClientSecret) {
    errors.push({ field: 'GOOGLE_CLIENT_SECRET', message: 'GOOGLE_CLIENT_SECRET is required' });
  }

  if (!config.googleRedirectUri) {
    errors.push({ field: 'GOOGLE_REDIRECT_URI', message: 'GOOGLE_REDIRECT_URI is required' });
  }

  if (!config.oauthTokenKey) {
    errors.push({ field: 'OAUTH_TOKEN_KEY', message: 'OAUTH_TOKEN_KEY is required' });
  } else if (!isValidTokenKey(config.oauthTokenKey)) {
    errors.push({ field: 'OAUTH_TOKEN_KEY', message: 'OAUTH_TOKEN_KEY must resolve to exactly 32 bytes' });
  }

  if (!config.adminEmail) {
    errors.push({ field: 'ADMIN_EMAIL', message: 'ADMIN_EMAIL is required' });
  }

  if (!config.adminPasswordHash) {
    errors.push({ field: 'ADMIN_PASSWORD_HASH', message: 'ADMIN_PASSWORD_HASH is required' });
  }

  if (config.nodeEnv === 'production') {
    validatePublicHttpsUrl('PUBLIC_APP_URL', config.publicAppUrl, errors);
    validatePublicHttpsUrl('GOOGLE_REDIRECT_URI', config.googleRedirectUri, errors);
    validatePublicHttpsUrl('GOOGLE_AUTH_REDIRECT_URI', config.googleAuthRedirectUri, errors);
    validatePublicHttpsUrl('TIKTOK_REDIRECT_URI', config.tiktokRedirectUri, errors);
    validatePublicHttpsUrl('INSTAGRAM_REDIRECT_URI', config.instagramRedirectUri, errors);

    for (const [field, value] of [
      ['DATABASE_URL', config.databaseUrl],
      ['GOOGLE_CLIENT_ID', config.googleClientId],
      ['GOOGLE_CLIENT_SECRET', config.googleClientSecret],
      ['TIKTOK_CLIENT_KEY', config.tiktokClientKey],
      ['TIKTOK_CLIENT_SECRET', config.tiktokClientSecret],
      ['INSTAGRAM_CLIENT_ID', config.instagramClientId],
      ['INSTAGRAM_CLIENT_SECRET', config.instagramClientSecret],
    ] as const) {
      if (isPlaceholder(value)) {
        errors.push({ field, message: `${field} is required in production and cannot be a placeholder` });
      }
    }

    if (!config.mediaStorageRoot) {
      errors.push({ field: 'MEDIA_STORAGE_ROOT', message: 'MEDIA_STORAGE_ROOT must point to a persistent mounted volume in production' });
    }

    const passwordHash = config.adminPasswordHash ?? '';
    if (passwordHash && !passwordHash.startsWith('scrypt:') && !passwordHash.startsWith('$argon2')) {
      errors.push({ field: 'ADMIN_PASSWORD_HASH', message: 'ADMIN_PASSWORD_HASH must use scrypt or Argon2 in production' });
    }

    if (isPlaceholder(config.adminEmail) || config.adminEmail?.endsWith('@example.com')) {
      errors.push({ field: 'ADMIN_EMAIL', message: 'ADMIN_EMAIL must be a real operational address in production' });
    }
  }

  if (isNaN(config.port)) {
    errors.push({ field: 'PORT', message: 'PORT must be a valid number' });
  } else if (config.port < 1 || config.port > 65535) {
    errors.push({ field: 'PORT', message: 'PORT must be in range 1-65535' });
  }

  if (!VALID_NODE_ENVS.includes(config.nodeEnv)) {
    errors.push({ field: 'NODE_ENV', message: `NODE_ENV must be one of: development, production, test` });
  }

  return errors;
}
