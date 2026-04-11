import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer, type ServerInstance } from './server';
import { SessionStore } from './auth/session-store';
import { createSecurityMiddleware } from './middleware/security';
import { createErrorHandler } from './middleware/error-handler';
import { createRateLimiter } from './middleware/rate-limiter';
import { createHealthCheck, type HealthCheckInstance } from './health';
import { createDatabaseProvider, type DatabaseProviderInstance } from './config/database-provider';
import { createAccountRepoAdapter } from './config/account-repo-adapter';
import { createChannelRepoAdapter } from './config/channel-repo-adapter';
import { createMediaRepoAdapter } from './config/media-repo-adapter';

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

  const mediaModuleOptions = databaseProvider.mediaAssetRepository
    ? { repository: createMediaRepoAdapter(databaseProvider.mediaAssetRepository) }
    : undefined;

  const server = createServer({ env, sessionResolver, campaignsModuleOptions, accountsModuleOptions, mediaModuleOptions });

  // Determine allowed origins
  const allowedOrigins = options.allowedOrigins ??
    (server.config.nodeEnv === 'production' ? [] : ['*']);

  const securityMiddleware = createSecurityMiddleware({ allowedOrigins });
  const errorHandler = createErrorHandler({ nodeEnv: server.config.nodeEnv });
  const authRateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });
  const healthCheck = createHealthCheck({
    nodeEnv: server.config.nodeEnv,
    getDatabaseStatus: () => ({
      configured: Boolean(env.DATABASE_URL),
      connected: databaseProvider.isConnected(),
      mode: databaseProvider.campaignRepository ? 'prisma' : 'in-memory',
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

        await server.requestHandler(req, res);
      });
    });
  };

  return { server, sessionStore, healthCheck, databaseProvider, handler };
}
