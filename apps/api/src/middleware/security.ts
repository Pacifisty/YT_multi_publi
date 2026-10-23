import type { IncomingMessage, ServerResponse } from 'node:http';

export interface SecurityMiddlewareOptions {
  allowedOrigins: string[];
}

type NextFn = () => Promise<void> | void;

const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
const ALLOWED_HEADERS = 'Content-Type, Authorization, Cookie';
const PREFLIGHT_MAX_AGE = '86400';
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "script-src-attr 'none'",
  "style-src 'self' https://fonts.googleapis.com",
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' data: blob: https:",
  "connect-src 'self'",
  "font-src 'self' data: https://fonts.gstatic.com",
  "upgrade-insecure-requests",
].join('; ');

export function createSecurityMiddleware(
  options: SecurityMiddlewareOptions,
): (req: IncomingMessage, res: ServerResponse, next: NextFn) => Promise<void> {
  const { allowedOrigins } = options;

  return async (req: IncomingMessage, res: ServerResponse, next: NextFn): Promise<void> => {
    // Security headers
    res.setHeader('x-content-type-options', 'nosniff');
    res.setHeader('x-frame-options', 'DENY');
    res.setHeader('x-xss-protection', '0');
    res.setHeader('strict-transport-security', 'max-age=31536000; includeSubDomains');
    res.setHeader('content-security-policy', CONTENT_SECURITY_POLICY);
    res.setHeader('referrer-policy', 'no-referrer');
    res.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');
    res.setHeader('cross-origin-opener-policy', 'same-origin-allow-popups');
    res.setHeader('cross-origin-resource-policy', 'same-origin');

    // CORS
    const origin = req.headers.origin;
    if (origin) {
      const isAllowed =
        allowedOrigins.includes('*') || allowedOrigins.includes(origin);

      if (!isAllowed) {
        res.setHeader('content-type', 'application/json');
        res.writeHead(403);
        res.end(JSON.stringify({ error: 'Forbidden origin.' }));
        return;
      }

      res.setHeader('access-control-allow-origin', origin);
      res.setHeader('access-control-allow-credentials', 'true');
      res.setHeader('vary', 'Origin');

      // Preflight
      if (req.method === 'OPTIONS' && req.headers['access-control-request-method']) {
        res.setHeader('access-control-allow-methods', ALLOWED_METHODS);
        res.setHeader('access-control-allow-headers', ALLOWED_HEADERS);
        res.setHeader('access-control-max-age', PREFLIGHT_MAX_AGE);
        res.writeHead(204);
        res.end();
        return;
      }
    }

    await next();
  };
}
