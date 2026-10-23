import type { IncomingMessage, ServerResponse } from 'node:http';

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
}

type NextFn = () => Promise<void> | void;

interface WindowEntry {
  count: number;
  resetAt: number;
}

function getClientIp(req: IncomingMessage): string {
  const remoteAddress = req.socket?.remoteAddress ?? 'unknown';
  if (isLoopback(remoteAddress)) {
    const cloudflare = req.headers['cf-connecting-ip'];
    if (cloudflare) {
      return (Array.isArray(cloudflare) ? cloudflare[0] : cloudflare).trim();
    }
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return first.trim();
    }
  }
  return remoteAddress;
}

function isLoopback(address: string): boolean {
  const normalized = address.toLowerCase();
  return normalized === '127.0.0.1'
    || normalized === '::1'
    || normalized === '::ffff:127.0.0.1';
}

export function createRateLimiter(
  options: RateLimiterOptions,
): (req: IncomingMessage, res: ServerResponse, next: NextFn) => Promise<void> {
  const { windowMs, maxRequests } = options;
  const clients = new Map<string, WindowEntry>();

  return async (req: IncomingMessage, res: ServerResponse, next: NextFn): Promise<void> => {
    const ip = getClientIp(req);
    const now = Date.now();

    // Opportunistic cleanup keeps a long-running process from retaining stale IPs.
    if (clients.size > 10_000) {
      for (const [clientIp, candidate] of clients.entries()) {
        if (now >= candidate.resetAt) clients.delete(clientIp);
      }
    }

    let entry = clients.get(ip);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      clients.set(ip, entry);
    }

    entry.count++;

    const remaining = Math.max(0, maxRequests - entry.count);
    const resetSeconds = Math.ceil((entry.resetAt - now) / 1000);

    if (entry.count > maxRequests) {
      res.setHeader('content-type', 'application/json');
      res.setHeader('retry-after', String(resetSeconds));
      res.setHeader('x-ratelimit-limit', String(maxRequests));
      res.setHeader('x-ratelimit-remaining', '0');
      res.setHeader('x-ratelimit-reset', String(Math.ceil(entry.resetAt / 1000)));
      res.writeHead(429);
      res.end(JSON.stringify({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded',
        retryAfter: resetSeconds,
      }));
      return;
    }

    res.setHeader('x-ratelimit-limit', String(maxRequests));
    res.setHeader('x-ratelimit-remaining', String(remaining));
    res.setHeader('x-ratelimit-reset', String(Math.ceil(entry.resetAt / 1000)));

    await next();
  };
}
