import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer, type ServerInstance } from './server';
import { SessionStore } from './auth/session-store';
import { createSecurityMiddleware } from './middleware/security';
import { createErrorHandler } from './middleware/error-handler';
import { createRateLimiter } from './middleware/rate-limiter';
import { createHealthCheck, type HealthCheckInstance } from './health';
import { createDatabaseProvider, type DatabaseProviderInstance } from './config/database-provider';
import type { AuthServiceOptions } from './auth/auth.service';
import { createAccountRepoAdapter } from './config/account-repo-adapter';
import { createChannelRepoAdapter } from './config/channel-repo-adapter';
import { createMediaRepoAdapter } from './config/media-repo-adapter';
import { createR2StorageFromEnv } from './media/storage/r2-storage.service';

export interface BootstrapOptions {
  env: Record<string, string | undefined>;
  allowedOrigins?: string[];
  _prismaFactory?: () => any;
  _prismaModule?: {
    PrismaClient: new (options?: unknown) => any;
  };
}

export interface BootstrapResult {
  server: ServerInstance;
  sessionStore: SessionStore;
  healthCheck: HealthCheckInstance;
  databaseProvider: DatabaseProviderInstance;
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
}

export function bootstrap(options: BootstrapOptions): BootstrapResult {
  const { env } = options;

  // Use OAUTH_TOKEN_KEY as HMAC secret for session tokens
  const sessionSecret = env.OAUTH_TOKEN_KEY ?? '';
  const sessionStore = new SessionStore({ secret: sessionSecret });
  const sessionResolver = sessionStore.createSessionResolver();

  const databaseProvider = createDatabaseProvider({
    databaseUrl: env.DATABASE_URL,
    _prismaFactory: options._prismaFactory,
    _prismaModule: options._prismaModule,
  });

  // Extract Prisma repositories if available, otherwise server defaults to in-memory
  const authModuleOptions: AuthServiceOptions | undefined = databaseProvider.authUserRepository
    ? {
        userStore: databaseProvider.authUserRepository,
        passwordResetStore: databaseProvider.passwordResetRepository ?? undefined,
      }
    : undefined;

  const campaignsModuleOptions = databaseProvider.campaignRepository
    ? {
        repository: databaseProvider.campaignRepository,
        jobServiceOptions: databaseProvider.publishJobRepository
          ? { repository: databaseProvider.publishJobRepository }
          : undefined,
        auditRepository: databaseProvider.auditEventRepository ?? undefined,
      }
    : undefined;

  // Wire connected account repository through adapter for AccountsService overrides
  const accountRepoOverrides = databaseProvider.connectedAccountRepository
    ? createAccountRepoAdapter(databaseProvider.connectedAccountRepository)
    : {};

  const channelStoreOverride = databaseProvider.youtubeChannelRepository
    ? { channelStore: createChannelRepoAdapter(databaseProvider.youtubeChannelRepository) }
    : {};

  const hasAccountOptions = databaseProvider.connectedAccountRepository || databaseProvider.youtubeChannelRepository;
  const accountsModuleOptions = hasAccountOptions
    ? { ...accountRepoOverrides, ...channelStoreOverride }
    : undefined;

  const mediaStorageRoot = env.MEDIA_STORAGE_ROOT || undefined;
  const mediaStorage = createR2StorageFromEnv(env, mediaStorageRoot);
  const mediaModuleOptions = {
        ...(env.MEDIA_IMPORT_ROOT ? { importRoot: env.MEDIA_IMPORT_ROOT } : {}),
        ...(mediaStorageRoot ? { storageRoot: mediaStorageRoot } : {}),
        ...(mediaStorage ? { storage: mediaStorage } : {}),
        ...(databaseProvider.mediaAssetRepository
          ? {
              repository: createMediaRepoAdapter(databaseProvider.mediaAssetRepository),
              orphanCleanupEnabled: true,
            }
          : {}),
        ...(databaseProvider.playlistRepository ? { playlistRepository: databaseProvider.playlistRepository } : {}),
        ...(databaseProvider.presetRepository ? { presetRepository: databaseProvider.presetRepository } : {}),
      };

  const server = createServer({
    env,
    sessionResolver,
    sessionStore,
    authModuleOptions,
    campaignsModuleOptions,
    accountsModuleOptions,
    mediaModuleOptions,
    accountPlanStore: databaseProvider.accountPlanRepository ?? undefined,
    paymentWebhookDeduplicator: databaseProvider.webhookDeduplicator,
    paymentRepository: databaseProvider.paymentRepository ?? undefined,
    serviceRequestRepository: databaseProvider.serviceRequestRepository ?? undefined,
  });

  // Determine allowed origins
  const allowedOrigins = options.allowedOrigins ?? deriveAllowedOrigins(env, server.config.nodeEnv);

  const securityMiddleware = createSecurityMiddleware({ allowedOrigins });
  const errorHandler = createErrorHandler({ nodeEnv: server.config.nodeEnv });
  const authRateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });
  const supportRateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 5 });
  const oauthRateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 30 });
  const mediaMutationRateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 240 });
  const healthCheck = createHealthCheck({
    nodeEnv: server.config.nodeEnv,
    getDatabaseStatus: () => ({
      configured: Boolean(env.DATABASE_URL),
      connected: databaseProvider.isConnected(),
      mode: env.DATABASE_URL ? 'prisma' : 'in-memory',
    }),
  });

  // Compose: error handler → security middleware → (health check | rate limiter → request handler)
  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    await errorHandler(req, res, async () => {
      await securityMiddleware(req, res, async () => {
        // Health/readiness checks — no auth, no rate limiting
        const path = (req.url ?? '/').split('?')[0];
        const isHeadRequest = req.method === 'HEAD';

        if (path === '/health' && (req.method === 'GET' || isHeadRequest)) {
          const result = healthCheck.handleRequest();
          res.setHeader('content-type', 'application/json');
          res.writeHead(result.status);
          res.end(isHeadRequest ? undefined : JSON.stringify(result.body));
          return;
        }

        if (path === '/ready' && (req.method === 'GET' || isHeadRequest)) {
          const result = healthCheck.handleReadyRequest();
          res.setHeader('content-type', 'application/json');
          res.writeHead(result.status);
          res.end(isHeadRequest ? undefined : JSON.stringify(result.body));
          return;
        }

        // Rate limit auth endpoints
        const isAuthRoute = path.startsWith('/auth/');
        if (isAuthRoute) {
          await authRateLimiter(req, res, async () => {
            await server.requestHandler(req, res);
          });
          return;
        }

        if (path.startsWith('/support/')) {
          await supportRateLimiter(req, res, async () => {
            await server.requestHandler(req, res);
          });
          return;
        }

        if (path.startsWith('/api/accounts/oauth/')) {
          await oauthRateLimiter(req, res, async () => {
            await server.requestHandler(req, res);
          });
          return;
        }

        if (path.startsWith('/api/media') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method ?? 'GET')) {
          await mediaMutationRateLimiter(req, res, async () => {
            await server.requestHandler(req, res);
          });
          return;
        }

        await server.requestHandler(req, res);
      });
    });
  };

  return { server, sessionStore, healthCheck, databaseProvider, handler };
}

function deriveAllowedOrigins(env: Record<string, string | undefined>, nodeEnv: string): string[] {
  if (nodeEnv !== 'production') return ['*'];

  const configured = [env.PUBLIC_APP_URL, env.ALLOWED_ORIGINS]
    .flatMap((value) => value?.split(',') ?? [])
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => {
      try {
        const url = new URL(value);
        return [url.origin];
      } catch {
        return [];
      }
    });

  return [...new Set(configured)];
}
