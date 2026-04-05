import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer, type ServerInstance } from './server';
import { SessionStore } from './auth/session-store';
import { createSecurityMiddleware } from './middleware/security';

export interface BootstrapOptions {
  env: Record<string, string | undefined>;
  allowedOrigins?: string[];
}

export interface BootstrapResult {
  server: ServerInstance;
  sessionStore: SessionStore;
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
}

export function bootstrap(options: BootstrapOptions): BootstrapResult {
  const { env } = options;

  // Use OAUTH_TOKEN_KEY as HMAC secret for session tokens
  const sessionSecret = env.OAUTH_TOKEN_KEY ?? '';
  const sessionStore = new SessionStore({ secret: sessionSecret });
  const sessionResolver = sessionStore.createSessionResolver();

  const server = createServer({ env, sessionResolver });

  // Determine allowed origins
  const allowedOrigins = options.allowedOrigins ??
    (server.config.nodeEnv === 'production' ? [] : ['*']);

  const securityMiddleware = createSecurityMiddleware({ allowedOrigins });

  // Compose: security middleware → request handler
  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    await securityMiddleware(req, res, async () => {
      await server.requestHandler(req, res);
    });
  };

  return { server, sessionStore, handler };
}
