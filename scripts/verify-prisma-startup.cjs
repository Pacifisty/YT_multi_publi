#!/usr/bin/env node
'use strict';

const { spawn, spawnSync } = require('child_process');
const { once } = require('events');
const net = require('net');

const START_TIMEOUT_MS = 20_000;
const HEALTH_TIMEOUT_MS = 20_000;
const POLL_INTERVAL_MS = 500;

function isWindows() {
  return process.platform === 'win32';
}

function npmCommand() {
  return isWindows() ? 'npm.cmd' : 'npm';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function usage() {
  console.log(`Usage: node --env-file-if-exists=.env scripts/verify-prisma-startup.cjs [--skip-generate] [--skip-deploy]

Runs a local Prisma startup verification flow:
1. Optionally runs Prisma generate
2. Optionally runs Prisma migrate deploy
3. Starts the API
4. Verifies /health and /ready report Prisma as connected and ready
`);
}

function isTcpDatabaseUrl(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    return ['postgres:', 'postgresql:'].includes(url.protocol);
  } catch {
    return false;
  }
}

function describeDatabaseTarget(databaseUrl) {
  const url = new URL(databaseUrl);
  return {
    hostname: url.hostname,
    port: Number(url.port || '5432'),
  };
}

async function ensureDatabaseReachable(databaseUrl) {
  if (!isTcpDatabaseUrl(databaseUrl)) {
    return;
  }

  const { hostname, port } = describeDatabaseTarget(databaseUrl);

  await new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: hostname, port });

    const onError = (error) => {
      socket.destroy();
      const localHint =
        hostname === '127.0.0.1' || hostname === 'localhost'
          ? ' If you use the bundled Postgres, start Docker Desktop and run `docker compose up -d` first.'
          : '';
      reject(
        new Error(
          `Cannot reach PostgreSQL at ${hostname}:${port}.${localHint}`,
        ),
      );
    };

    socket.setTimeout(5_000, () => onError(new Error('timeout')));
    socket.once('error', onError);
    socket.once('connect', () => {
      socket.end();
      resolve();
    });
  });
}

function runStep(label, args) {
  console.log(`[verify:prisma-startup] ${label}`);
  const result = isWindows()
    ? spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', [npmCommand(), ...args].join(' ')], {
        stdio: 'inherit',
        env: { ...process.env },
        windowsHide: true,
      })
    : spawnSync(npmCommand(), args, {
        stdio: 'inherit',
        env: { ...process.env },
      });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}.`);
  }
}

function formatStartupOutput(output) {
  const normalized = output.trim();

  if (normalized.includes('does not exist')) {
    return `${normalized}\n[verify:prisma-startup] Fix: create the configured database or update DATABASE_URL, then run \`npm run db:deploy\`.\n[verify:prisma-startup] Bundled Postgres tip: if you use docker-compose and an old volume, run \`docker compose down -v\` and then \`docker compose up -d\` to recreate \`yt_multi_publi\`.`;
  }

  if (normalized.includes('Database schema is missing required tables')) {
    return `${normalized}\n[verify:prisma-startup] Fix: run \`npm run db:deploy\` against the configured database.`;
  }

  if (normalized.includes('Prisma Client is not available')) {
    return `${normalized}\n[verify:prisma-startup] Fix: run \`npm install\` and \`npm run db:generate\`.`;
  }

  return normalized;
}

async function waitForServerUrl(child) {
  const deadline = Date.now() + START_TIMEOUT_MS;
  let output = '';

  const onStdout = (chunk) => {
    const text = chunk.toString();
    output += text;
  };

  const onStderr = (chunk) => {
    const text = chunk.toString();
    output += text;
  };

  child.stdout.on('data', onStdout);
  child.stderr.on('data', onStderr);

  try {
    while (Date.now() < deadline) {
      const match = output.match(/\[api\] running on (http:\/\/[^\s]+)/);
      if (match) {
        return match[1];
      }

      if (child.exitCode !== null) {
        throw new Error(`API exited before reporting a listening URL.\n${formatStartupOutput(output)}`);
      }

      await sleep(100);
    }

    throw new Error(`Timed out waiting for API startup.\n${formatStartupOutput(output)}`);
  } finally {
    child.stdout.off('data', onStdout);
    child.stderr.off('data', onStderr);
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  const text = await response.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { status: response.status, body };
}

async function waitForHealthyPrisma(baseUrl) {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let lastHealth = null;
  let lastReady = null;

  while (Date.now() < deadline) {
    try {
      lastHealth = await fetchJson(`${baseUrl}/health`);
      lastReady = await fetchJson(`${baseUrl}/ready`);

      const healthOk =
        lastHealth.status === 200 &&
        lastHealth.body &&
        lastHealth.body.database &&
        lastHealth.body.database.configured === true &&
        lastHealth.body.database.mode === 'prisma' &&
        lastHealth.body.database.connected === true;

      const readyOk =
        lastReady.status === 200 &&
        lastReady.body &&
        lastReady.body.status === 'ready' &&
        lastReady.body.ready === true;

      if (healthOk && readyOk) {
        return { health: lastHealth, ready: lastReady };
      }
    } catch {
      // Keep polling while the server settles.
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    `Timed out waiting for Prisma health/readiness.\nhealth=${JSON.stringify(lastHealth)}\nready=${JSON.stringify(lastReady)}`,
  );
}

async function shutdownChild(child) {
  if (child.exitCode !== null) {
    return;
  }

  child.kill('SIGINT');
  await Promise.race([
    once(child, 'exit'),
    sleep(5_000).then(() => {
      if (child.exitCode === null) {
        child.kill('SIGTERM');
      }
    }),
  ]);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  if (args.has('--help') || args.has('-h')) {
    usage();
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL must be configured in the environment or .env before running verify:prisma-startup.');
  }

  await ensureDatabaseReachable(process.env.DATABASE_URL);

  if (!args.has('--skip-generate')) {
    runStep('Running Prisma generate', ['run', 'db:generate']);
  }

  if (!args.has('--skip-deploy')) {
    runStep('Running Prisma migrate deploy', ['run', 'db:deploy']);
  }

  console.log('[verify:prisma-startup] Starting API');
  const child = spawn(
    process.execPath,
    ['--env-file-if-exists=.env', '--import', 'tsx', 'apps/api/src/cli.ts'],
    {
      cwd: process.cwd(),
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);

  try {
    const baseUrl = await waitForServerUrl(child);
    const result = await waitForHealthyPrisma(baseUrl);

    console.log('[verify:prisma-startup] Verification passed');
    console.log(`[verify:prisma-startup] /health => ${JSON.stringify(result.health.body)}`);
    console.log(`[verify:prisma-startup] /ready => ${JSON.stringify(result.ready.body)}`);
  } finally {
    await shutdownChild(child);
  }
}

main().catch((error) => {
  console.error('[verify:prisma-startup] Verification failed');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
