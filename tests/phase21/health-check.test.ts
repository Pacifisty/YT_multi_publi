import { describe, it, expect, vi } from 'vitest';
import { createHealthCheck, type HealthCheckOptions } from '../../apps/api/src/health';

describe('Health Check Endpoint', () => {
  it('returns status ok', () => {
    const health = createHealthCheck({});
    const result = health.check();

    expect(result.status).toBe('ok');
  });

  it('returns uptime in seconds', () => {
    const health = createHealthCheck({});
    const result = health.check();

    expect(typeof result.uptime).toBe('number');
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });

  it('returns current timestamp', () => {
    const now = Date.now();
    const health = createHealthCheck({});
    const result = health.check();

    expect(result.timestamp).toBeGreaterThanOrEqual(now - 100);
    expect(result.timestamp).toBeLessThanOrEqual(now + 100);
  });

  it('returns version from options', () => {
    const health = createHealthCheck({ version: '1.2.3' });
    const result = health.check();

    expect(result.version).toBe('1.2.3');
  });

  it('defaults version to unknown when not provided', () => {
    const health = createHealthCheck({});
    const result = health.check();

    expect(result.version).toBe('unknown');
  });

  it('returns environment from options', () => {
    const health = createHealthCheck({ nodeEnv: 'production' });
    const result = health.check();

    expect(result.environment).toBe('production');
  });

  it('defaults environment to development', () => {
    const health = createHealthCheck({});
    const result = health.check();

    expect(result.environment).toBe('development');
  });

  it('uptime increases over time', () => {
    vi.useFakeTimers();

    const health = createHealthCheck({});
    const result1 = health.check();

    vi.advanceTimersByTime(5000);
    const result2 = health.check();

    expect(result2.uptime - result1.uptime).toBeCloseTo(5, 0);

    vi.useRealTimers();
  });

  it('handles the health check as a route handler returning HttpResponse', () => {
    const health = createHealthCheck({ version: '2.0.0', nodeEnv: 'test' });
    const response = health.handleRequest();

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.version).toBe('2.0.0');
    expect(response.body.environment).toBe('test');
    expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    expect(response.body.timestamp).toBeDefined();
  });

  it('response body matches check() output', () => {
    const health = createHealthCheck({ version: '1.0.0' });
    const checkResult = health.check();
    const response = health.handleRequest();

    expect(response.body.status).toBe(checkResult.status);
    expect(response.body.version).toBe(checkResult.version);
  });
});
