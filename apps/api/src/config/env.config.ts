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
  port: number;
  nodeEnv: string;
}

export interface EnvValidationError {
  field: string;
  message: string;
}

const VALID_NODE_ENVS = ['development', 'production', 'test'];

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
