export interface EnvConfig {
  databaseUrl: string | undefined;
  googleClientId: string | undefined;
  googleClientSecret: string | undefined;
  googleRedirectUri: string | undefined;
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

export function loadEnvConfig(env: Record<string, string | undefined>): EnvConfig {
  const rawPort = env.PORT;
  const port = rawPort ? parseInt(rawPort, 10) : 3000;

  return {
    databaseUrl: env.DATABASE_URL,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    googleRedirectUri: env.GOOGLE_REDIRECT_URI,
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
  } else if (config.oauthTokenKey.length !== 32) {
    errors.push({ field: 'OAUTH_TOKEN_KEY', message: 'OAUTH_TOKEN_KEY must be exactly 32 bytes' });
  }

  if (!config.adminEmail) {
    errors.push({ field: 'ADMIN_EMAIL', message: 'ADMIN_EMAIL is required' });
  }

  if (!config.adminPasswordHash) {
    errors.push({ field: 'ADMIN_PASSWORD_HASH', message: 'ADMIN_PASSWORD_HASH is required' });
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
