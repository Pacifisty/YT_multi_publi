import type { IncomingMessage, ServerResponse } from 'node:http';

export interface LogEntry {
  timestamp: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  ip: string;
  userAgent?: string;
  error?: string;
}

export interface RequestLoggerOptions {
  onLog: (entry: LogEntry) => void;
}

type NextFn = () => Promise<void> | void;

function getClientIp(req: IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return first.trim();
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

export function createRequestLogger(
  options: RequestLoggerOptions,
): (req: IncomingMessage, res: ServerResponse, next: NextFn) => Promise<void> {
  const { onLog } = options;

  return async (req: IncomingMessage, res: ServerResponse, next: NextFn): Promise<void> => {
    const start = Date.now();
    const method = req.method ?? 'GET';
    const rawUrl = req.url ?? '/';
    const path = rawUrl.split('?')[0];
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] as string | undefined;

    let error: string | undefined;

    try {
      await next();
    } catch (err: unknown) {
      error = err instanceof Error ? err.message : String(err);
      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        method,
        path,
        status: res.statusCode ?? 500,
        durationMs: Date.now() - start,
        ip,
        userAgent,
        error,
      };
      onLog(entry);
      throw err;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      method,
      path,
      status: res.statusCode ?? 200,
      durationMs: Date.now() - start,
      ip,
      userAgent,
    };

    onLog(entry);
  };
}
