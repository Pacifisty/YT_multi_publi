import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AppInstance, HttpRequest, HttpResponse } from './app';
import type { AdminSession } from './auth/session.guard';
import { isFrontendRoute, renderFrontendDocument, resolveFrontendAsset } from './frontend/ui-shell';

export interface RequestHandlerOptions {
  app: AppInstance;
  sessionResolver?: (cookieHeader: string | undefined) => AdminSession | null;
}

interface CookieEntry {
  name: string;
  value: string;
  options?: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: string;
    path?: string;
    maxAge?: number;
  };
}

function serializeCookie(cookie: CookieEntry): string {
  let str = `${cookie.name}=${cookie.value}`;
  const opts = {
    ...(cookie.options ?? {}),
    path: cookie.options?.path ?? (cookie as any).path,
    httpOnly: cookie.options?.httpOnly ?? (cookie as any).httpOnly,
    secure: cookie.options?.secure ?? (cookie as any).secure,
    sameSite: cookie.options?.sameSite ?? (cookie as any).sameSite,
    maxAge: cookie.options?.maxAge ?? (cookie as any).maxAge,
  };
  if (opts.path) str += `; Path=${opts.path}`;
  if (opts.httpOnly) str += '; HttpOnly';
  if (opts.secure) str += '; Secure';
  if (opts.sameSite) str += `; SameSite=${opts.sameSite}`;
  if (opts.maxAge !== undefined) str += `; Max-Age=${opts.maxAge}`;
  return str;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

function parseQuery(rawUrl: string): Record<string, string> {
  const queryString = rawUrl.includes('?') ? rawUrl.slice(rawUrl.indexOf('?') + 1) : '';
  if (!queryString) {
    return {};
  }

  const params = new URLSearchParams(queryString);
  const query: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    query[key] = value;
  }
  return query;
}

export function createRequestHandler(
  options: RequestHandlerOptions,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const { app, sessionResolver } = options;

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const method = req.method ?? 'GET';
    const rawUrl = req.url ?? '/';
    const path = rawUrl.split('?')[0];
    const query = parseQuery(rawUrl);

    if (method === 'GET' || method === 'HEAD') {
      const frontendAsset = resolveFrontendAsset(path);
      if (frontendAsset) {
        res.setHeader('content-type', frontendAsset.contentType);
        res.setHeader('cache-control', 'no-cache');
        res.writeHead(200);
        res.end(method === 'HEAD' ? undefined : frontendAsset.body);
        return;
      }

      if (isFrontendRoute(path)) {
        const html = renderFrontendDocument(path);
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.setHeader('cache-control', 'no-cache');
        res.writeHead(200);
        res.end(method === 'HEAD' ? undefined : html);
        return;
      }
    }

    const session = sessionResolver
      ? sessionResolver(req.headers.cookie) ?? null
      : null;

    let body: unknown = undefined;

    if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
      const raw = await readBody(req);
      if (raw.length > 0) {
        try {
          body = JSON.parse(raw);
        } catch {
          res.setHeader('content-type', 'application/json');
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          return;
        }
      }
    }

    const httpRequest: HttpRequest = { method, path, session, body, query };
    const httpResponse: HttpResponse = await app.handleRequest(httpRequest);

    res.setHeader('content-type', 'application/json');

    if (httpResponse.cookies && httpResponse.cookies.length > 0) {
      const serialized = httpResponse.cookies.map((c: CookieEntry) => serializeCookie(c));
      res.setHeader('set-cookie', serialized);
    }

    res.writeHead(httpResponse.status);
    res.end(JSON.stringify(httpResponse.body));
  };
}
