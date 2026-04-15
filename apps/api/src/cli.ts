import { startServer } from './start';

function parsePort(rawPort: string | undefined): number | undefined {
  if (!rawPort) {
    return undefined;
  }

  const parsed = Number(rawPort);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function formatStartupError(error: unknown): string[] {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('Prisma Client is not available')) {
    return [
      '[api] failed to start',
      `[api] ${message}`,
      '[api] Fix: run `npm install` and `npm run db:generate`, then start the server again.',
    ];
  }

  if (message.includes('Database schema is missing required tables')) {
    return [
      '[api] failed to start',
      `[api] ${message}`,
      '[api] Fix: run `npm run db:deploy` against the configured database, then start the server again.',
    ];
  }

  return ['[api] failed to start', message];
}

async function main(): Promise<void> {
  const requestedPort = parsePort(process.env.PORT);
  const server = await startServer({
    env: process.env,
    port: requestedPort,
  });

  const host = process.env.HOST ?? '127.0.0.1';
  // Keep logs explicit so local startup status is easy to spot.
  console.log(`[api] running on http://${host}:${server.port}`);
}

main().catch((error: unknown) => {
  for (const line of formatStartupError(error)) {
    console.error(line);
  }
  process.exitCode = 1;
});
