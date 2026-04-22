import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
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

function parseMediaFileId(path: string): string | null {
  const match = path.match(/^\/media-files\/([^/]+)$/);
  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function parsePublicMediaFileId(path: string): string | null {
  const match = path.match(/^\/public-media\/([^/]+)$/);
  if (!match) {
    return null;
  }

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function parseByteRange(rangeHeader: string | undefined, totalSize: number): { start: number; end: number } | null {
  if (typeof rangeHeader !== 'string' || !rangeHeader.startsWith('bytes=')) {
    return null;
  }

  const [startRaw, endRaw] = rangeHeader.slice('bytes='.length).split('-', 2);
  if (!startRaw && !endRaw) {
    return null;
  }

  let start = 0;
  let end = totalSize - 1;

  if (!startRaw) {
    const suffixLength = Number(endRaw);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      return null;
    }
    start = Math.max(totalSize - suffixLength, 0);
  } else {
    start = Number(startRaw);
    if (!Number.isInteger(start) || start < 0 || start >= totalSize) {
      return null;
    }

    if (endRaw) {
      end = Number(endRaw);
      if (!Number.isInteger(end) || end < start) {
        return null;
      }
    }
  }

  end = Math.min(end, totalSize - 1);
  return { start, end };
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

    if (method === 'GET' || method === 'HEAD') {
      const publicMediaFileId = parsePublicMediaFileId(path);
      if (publicMediaFileId) {
        const verified = app.publicMediaUrlService?.verify(
          publicMediaFileId,
          query.expires,
          query.signature,
        ) ?? false;

        if (!verified) {
          res.setHeader('content-type', 'text/plain; charset=utf-8');
          res.writeHead(403);
          res.end(method === 'HEAD' ? undefined : 'Invalid or expired media signature.');
          return;
        }

        const mediaFile = await app.mediaModule.mediaService.getAssetFile(publicMediaFileId);
        if (!mediaFile) {
          res.setHeader('content-type', 'text/plain; charset=utf-8');
          res.writeHead(404);
          res.end(method === 'HEAD' ? undefined : 'Asset not found.');
          return;
        }

        let fileBuffer: Buffer;
        try {
          fileBuffer = await readFile(mediaFile.absolute_path);
        } catch {
          res.setHeader('content-type', 'text/plain; charset=utf-8');
          res.writeHead(404);
          res.end(method === 'HEAD' ? undefined : 'Asset file not found.');
          return;
        }

        const range = parseByteRange(req.headers.range, fileBuffer.byteLength);
        if (typeof req.headers.range === 'string' && req.headers.range && !range) {
          res.setHeader('content-type', 'text/plain; charset=utf-8');
          res.setHeader('content-range', `bytes */${fileBuffer.byteLength}`);
          res.writeHead(416);
          res.end(method === 'HEAD' ? undefined : 'Invalid range.');
          return;
        }

        const responseBuffer = range
          ? fileBuffer.subarray(range.start, range.end + 1)
          : fileBuffer;

        res.setHeader('content-type', mediaFile.asset.mime_type || 'application/octet-stream');
        res.setHeader('cache-control', 'private, max-age=60');
        res.setHeader('accept-ranges', 'bytes');
        res.setHeader('content-length', String(responseBuffer.byteLength));

        if (range) {
          res.setHeader('content-range', `bytes ${range.start}-${range.end}/${fileBuffer.byteLength}`);
          res.writeHead(206);
        } else {
          res.writeHead(200);
        }

        res.end(method === 'HEAD' ? undefined : responseBuffer);
        return;
      }

      const mediaFileId = parseMediaFileId(path);
      if (mediaFileId) {
        if (!session?.adminUser) {
          res.setHeader('content-type', 'text/plain; charset=utf-8');
          res.writeHead(401);
          res.end(method === 'HEAD' ? undefined : 'Authentication required.');
          return;
        }

        const mediaFile = await app.mediaModule.mediaService.getAssetFile(mediaFileId);
        if (!mediaFile) {
          res.setHeader('content-type', 'text/plain; charset=utf-8');
          res.writeHead(404);
          res.end(method === 'HEAD' ? undefined : 'Asset not found.');
          return;
        }

        let fileBuffer: Buffer;
        try {
          fileBuffer = await readFile(mediaFile.absolute_path);
        } catch {
          res.setHeader('content-type', 'text/plain; charset=utf-8');
          res.writeHead(404);
          res.end(method === 'HEAD' ? undefined : 'Asset file not found.');
          return;
        }

        const range = parseByteRange(req.headers.range, fileBuffer.byteLength);
        if (typeof req.headers.range === 'string' && req.headers.range && !range) {
          res.setHeader('content-type', 'text/plain; charset=utf-8');
          res.setHeader('content-range', `bytes */${fileBuffer.byteLength}`);
          res.writeHead(416);
          res.end(method === 'HEAD' ? undefined : 'Invalid range.');
          return;
        }

        const responseBuffer = range
          ? fileBuffer.subarray(range.start, range.end + 1)
          : fileBuffer;

        res.setHeader('content-type', mediaFile.asset.mime_type || 'application/octet-stream');
        res.setHeader('cache-control', 'no-cache');
        res.setHeader('accept-ranges', 'bytes');
        res.setHeader('content-length', String(responseBuffer.byteLength));

        if (range) {
          res.setHeader('content-range', `bytes ${range.start}-${range.end}/${fileBuffer.byteLength}`);
          res.writeHead(206);
        } else {
          res.writeHead(200);
        }

        res.end(method === 'HEAD' ? undefined : responseBuffer);
        return;
      }
    }

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
