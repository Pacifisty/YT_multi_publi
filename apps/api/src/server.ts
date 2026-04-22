import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp, type AppInstance } from './app';
import { createRequestHandler } from './http-adapter';
import { loadEnvConfig, validateEnvConfig, type EnvConfig } from './config/env.config';
import type { AdminSession } from './auth/session.guard';
import type { CampaignsModuleOptions } from './campaigns/campaigns.module';
import type { AccountsServiceOptions } from './accounts/accounts.service';
import type { MediaServiceOptions } from './media/media.service';
import type { AuthServiceOptions } from './auth/auth.service';
import type { AccountPlanStore } from './account-plan/account-plan.service';

export interface ServerConfig extends EnvConfig {}

export interface ServerOptions {
  env: Record<string, string | undefined>;
  sessionResolver?: (cookieHeader: string | undefined) => AdminSession | null;
  authModuleOptions?: AuthServiceOptions;
  campaignsModuleOptions?: CampaignsModuleOptions;
  accountsModuleOptions?: AccountsServiceOptions;
  mediaModuleOptions?: MediaServiceOptions;
  accountPlanStore?: AccountPlanStore;
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
    authModuleOptions: options.authModuleOptions,
    campaignsModuleOptions: options.campaignsModuleOptions,
    accountsModuleOptions: options.accountsModuleOptions,
    mediaModuleOptions: options.mediaModuleOptions,
    accountPlanStore: options.accountPlanStore,
  });

  const requestHandler = createRequestHandler({
    app,
    sessionResolver: options.sessionResolver,
  });

  return { app, config, requestHandler };
}
