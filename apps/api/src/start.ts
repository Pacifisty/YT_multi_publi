import { createServer as createHttpServer } from 'node:http';
import { bootstrap, type BootstrapOptions, type BootstrapResult } from './bootstrap';
import { createGracefulShutdown } from './lifecycle/graceful-shutdown';

export interface StartServerOptions {
  env: Record<string, string | undefined>;
  _prismaFactory?: () => any;
  _prismaModule?: {
    PrismaClient: new (options?: unknown) => any;
  };
  allowedOrigins?: string[];
  port?: number;
}

export interface StartServerResult {
  port: number;
  bootstrapResult: BootstrapResult;
  shutdown: () => Promise<void>;
}

export async function startServer(options: StartServerOptions): Promise<StartServerResult> {
  const bootstrapOptions: BootstrapOptions = {
    env: options.env,
    _prismaFactory: options._prismaFactory,
    _prismaModule: options._prismaModule,
    allowedOrigins: options.allowedOrigins,
  };

  const bootstrapResult = bootstrap(bootstrapOptions);

  // Connect database if configured
  await bootstrapResult.databaseProvider.connect();

  const backgroundProcessorInterval = bootstrapResult.server.app.backgroundProcessor
    ? setInterval(() => {
        void bootstrapResult.server.app.backgroundProcessor?.kick();
      }, 15_000)
    : null;

  if (backgroundProcessorInterval) {
    backgroundProcessorInterval.unref?.();
  }

  const httpServer = createHttpServer((req, res) => {
    bootstrapResult.handler(req, res).catch(() => {
      if (res.writableEnded) {
        return;
      }

      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Internal server error' }));
        return;
      }

      res.end();
    });
  });

  const requestedPort = options.port ?? parseInt(options.env.PORT ?? '3000', 10);

  let port: number;
  try {
    port = await new Promise<number>((resolve, reject) => {
      const handleListenError = (error: Error) => {
        httpServer.removeListener('error', handleListenError);
        reject(error);
      };

      httpServer.on('error', handleListenError);
      httpServer.listen(requestedPort, () => {
        httpServer.removeListener('error', handleListenError);
        const addr = httpServer.address();
        const actualPort = typeof addr === 'object' && addr ? addr.port : requestedPort;
        resolve(actualPort);
      });
    });
  } catch (error) {
    if (backgroundProcessorInterval) {
      clearInterval(backgroundProcessorInterval);
    }
    await bootstrapResult.databaseProvider.disconnect();
    throw error;
  }

  const gracefulShutdown = createGracefulShutdown({ timeoutMs: 10_000 });

  const handleSignal = async (): Promise<void> => {
    await shutdown();
  };

  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);

  gracefulShutdown.onShutdown(async () => {
    process.removeListener('SIGINT', handleSignal);
    process.removeListener('SIGTERM', handleSignal);

    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()));
    });

    if (backgroundProcessorInterval) {
      clearInterval(backgroundProcessorInterval);
    }

    await bootstrapResult.databaseProvider.disconnect();
  });

  const shutdown = async (): Promise<void> => {
    await gracefulShutdown.shutdown();
  };

  return { port, bootstrapResult, shutdown };
}
