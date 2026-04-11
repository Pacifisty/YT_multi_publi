import { startServer } from './start';

function parsePort(rawPort: string | undefined): number | undefined {
  if (!rawPort) {
    return undefined;
  }

  const parsed = Number(rawPort);
  return Number.isFinite(parsed) ? parsed : undefined;
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
  console.error('[api] failed to start');
  console.error(error);
  process.exitCode = 1;
});
