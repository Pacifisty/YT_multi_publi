export interface HealthCheckOptions {
  version?: string;
  nodeEnv?: string;
}

export interface HealthCheckResult {
  status: 'ok';
  uptime: number;
  timestamp: number;
  version: string;
  environment: string;
}

export interface HealthCheckInstance {
  check(): HealthCheckResult;
  handleRequest(): { status: number; body: HealthCheckResult };
}

export function createHealthCheck(options: HealthCheckOptions): HealthCheckInstance {
  const version = options.version ?? 'unknown';
  const environment = options.nodeEnv ?? 'development';
  const startedAt = Date.now();

  function check(): HealthCheckResult {
    return {
      status: 'ok',
      uptime: (Date.now() - startedAt) / 1000,
      timestamp: Date.now(),
      version,
      environment,
    };
  }

  function handleRequest(): { status: number; body: HealthCheckResult } {
    return { status: 200, body: check() };
  }

  return { check, handleRequest };
}
