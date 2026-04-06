import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp, type AppInstance } from './app';
import { createRequestHandler } from './http-adapter';
import { loadEnvConfig, validateEnvConfig, type EnvConfig } from './config/env.config';
import type { AdminSession } from './auth/session.guard';
import type { CampaignsModuleOptions } from './campaigns/campaigns.module';
import type { AccountsServiceOptions } from './accounts/accounts.service';
import type { MediaServiceOptions } from './media/media.service';

export interface ServerConfig extends EnvConfig {}

export interface ServerOptions {
  env: Record<string, string | undefined>;
  sessionResolver?: (cookieHeader: string | undefined) => AdminSession | null;
  campaignsModuleOptions?: CampaignsModuleOptions;
  accountsModuleOptions?: AccountsServiceOptions;
  mediaModuleOptions?: MediaServiceOptions;
}

export interface ServerInstance {
  app: AppInstance;
  config: ServerConfig;
  requestHandler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
}

export function createServer(options: ServerOptions): ServerInstance {
  const config = loadEnvConfig(options.env);
  const errors = validateEnvConfig(config);

  if (errors.length > 0) {
    const messages = errors.map((e) => `  ${e.field}: ${e.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${messages}`);
  }

  const app = createApp({
    env: options.env,
    campaignsModuleOptions: options.campaignsModuleOptions,
    accountsModuleOptions: options.accountsModuleOptions,
    mediaModuleOptions: options.mediaModuleOptions,
  });

  const requestHandler = createRequestHandler({
    app,
    sessionResolver: options.sessionResolver,
  });

  return { app, config, requestHandler };
}
