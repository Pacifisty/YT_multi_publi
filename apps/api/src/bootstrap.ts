import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer, type ServerInstance } from './server';
import { SessionStore } from './auth/session-store';
import { createSecurityMiddleware } from './middleware/security';
import { createErrorHandler } from './middleware/error-handler';
import { createRateLimiter } from './middleware/rate-limiter';
import { createHealthCheck, type HealthCheckInstance } from './health';
import { createDatabaseProvider, type DatabaseProviderInstance } from './config/database-provider';

export interface BootstrapOptions {
  env: Record<string, string | undefined>;
  allowedOrigins?: string[];
  _prismaFactory?: () => any;
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
  });

  // Extract Prisma repository if available, otherwise server defaults to in-memory
  const campaignsModuleOptions = databaseProvider.campaignRepository
    ? { repository: databaseProvider.campaignRepository }
    : undefined;

  const server = createServer({ env, sessionResolver, campaignsModuleOptions });

  // Determine allowed origins
  const allowedOrigins = options.allowedOrigins ??
    (server.config.nodeEnv === 'production' ? [] : ['*']);

  const securityMiddleware = createSecurityMiddleware({ allowedOrigins });
  const errorHandler = createErrorHandler({ nodeEnv: server.config.nodeEnv });
  const authRateLimiter = createRateLimiter({ windowMs: 60_000, maxRequests: 10 });
  const healthCheck = createHealthCheck({
    nodeEnv: server.config.nodeEnv,
  });

  // Compose: error handler → security middleware → (health check | rate limiter → request handler)
  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    await errorHandler(req, res, async () => {
      await securityMiddleware(req, res, async () => {
        // Health check — no auth, no rate limiting
        const path = (req.url ?? '/').split('?')[0];
        if (path === '/health' && (req.method === 'GET' || req.method === 'HEAD')) {
          const result = healthCheck.handleRequest();
          res.setHeader('content-type', 'application/json');
          res.writeHead(result.status);
          res.end(JSON.stringify(result.body));
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
