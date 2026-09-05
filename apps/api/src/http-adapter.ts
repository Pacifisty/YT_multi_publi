import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFile, mkdir, unlink } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { brotliCompressSync, constants as zlibConstants, gzipSync } from 'node:zlib';
import Busboy from 'busboy';
import type { AppInstance, HttpRequest, HttpResponse } from './app';
import type { AdminSession } from './auth/session.guard';
import {
  isFrontendRoute,
  normalizeFrontendLocale,
  renderFrontendDocument,
  resolveFrontendAsset,
  type FrontendLocale,
} from './frontend/ui-shell';

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

type FrontendContentEncoding = 'br' | 'gzip' | 'identity';

interface CachedFrontendContent {
  source: string | Buffer;
  identity: Buffer;
  hash: string;
  variants: Partial<Record<Exclude<FrontendContentEncoding, 'identity'>, Buffer>>;
}

const FRONTEND_COMPRESSION_THRESHOLD = 1_024;
const frontendContentCache = new Map<string, CachedFrontendContent>();

function encodingIsAccepted(header: string | string[] | undefined, encoding: string): boolean {
  const value = Array.isArray(header) ? header.join(',') : header ?? '';
  return value.split(',').some((entry) => {
    const [name, ...parameters] = entry.trim().toLowerCase().split(';');
    if (name !== encoding && name !== '*') {
      return false;
    }
    const quality = parameters
      .map((parameter) => parameter.trim())
      .find((parameter) => parameter.startsWith('q='));
    return quality ? Number(quality.slice(2)) > 0 : true;
  });
}

function isCompressibleFrontendType(contentType: string): boolean {
  return contentType.startsWith('text/')
    || contentType.includes('javascript')
    || contentType.includes('json')
    || contentType.includes('xml')
    || contentType.includes('svg');
}

function getCachedFrontendContent(cacheKey: string, source: string | Buffer): CachedFrontendContent {
  const cached = frontendContentCache.get(cacheKey);
  if (cached?.source === source) {
    return cached;
  }

  const identity = Buffer.isBuffer(source) ? source : Buffer.from(source);
  const content: CachedFrontendContent = {
    source,
    identity,
    hash: createHash('sha256').update(identity).digest('base64url').slice(0, 24),
    variants: {},
  };
  frontendContentCache.set(cacheKey, content);
  return content;
}

function requestMatchesEtag(header: string | string[] | undefined, etag: string): boolean {
  const value = Array.isArray(header) ? header.join(',') : header ?? '';
  return value.split(',').some((candidate) => candidate.trim() === etag || candidate.trim() === '*');
}

function sendOptimizedFrontendBody(
  req: IncomingMessage,
  res: ServerResponse,
  options: {
    body: string | Buffer;
    cacheControl: string;
    cacheKey: string;
    contentType: string;
    method: string;
    vary?: string;
  },
): void {
  const cached = getCachedFrontendContent(options.cacheKey, options.body);
  const canCompress = cached.identity.length >= FRONTEND_COMPRESSION_THRESHOLD
    && isCompressibleFrontendType(options.contentType);
  let encoding: FrontendContentEncoding = 'identity';

  if (canCompress && encodingIsAccepted(req.headers['accept-encoding'], 'br')) {
    encoding = 'br';
  } else if (canCompress && encodingIsAccepted(req.headers['accept-encoding'], 'gzip')) {
    encoding = 'gzip';
  }

  let responseBody = cached.identity;
  if (encoding === 'br') {
    cached.variants.br ??= brotliCompressSync(cached.identity, {
      params: {
        [zlibConstants.BROTLI_PARAM_QUALITY]: 5,
      },
    });
    responseBody = cached.variants.br;
  } else if (encoding === 'gzip') {
    cached.variants.gzip ??= gzipSync(cached.identity, { level: 6 });
    responseBody = cached.variants.gzip;
  }

  const etag = `W/"${cached.hash}-${encoding}"`;
  res.setHeader('content-type', options.contentType);
  res.setHeader('cache-control', options.cacheControl);
  res.setHeader('etag', etag);
  res.setHeader('vary', options.vary ?? 'accept-encoding');
  if (encoding !== 'identity') {
    res.setHeader('content-encoding', encoding);
  }

  if (requestMatchesEtag(req.headers['if-none-match'], etag)) {
    res.writeHead(304);
    res.end();
    return;
  }

  res.setHeader('content-length', responseBody.length);
  res.writeHead(200);
  const responsePayload = encoding === 'identity' ? options.body : responseBody;
  res.end(options.method === 'HEAD' ? undefined : responsePayload);
}

function frontendAssetCacheControl(path: string, hasVersion: boolean): string {
  if (hasVersion && (path === '/app.js' || path === '/app.css' || path === '/i18n.js')) {
    return 'public, max-age=31536000, immutable';
  }
  if (path.startsWith('/assets/')) {
    return 'public, max-age=86400, stale-while-revalidate=604800';
  }
  if (path === '/robots.txt' || path === '/sitemap.xml') {
    return 'public, max-age=3600, stale-while-revalidate=86400';
  }
  return 'public, max-age=0, must-revalidate';
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

interface MultipartField {
  originalname: string;
  mimetype: string;
  filePath: string;
  size: number;
}

function parseMultipart(req: IncomingMessage, tmpDir: string): Promise<{ fields: Record<string, string>; files: Record<string, MultipartField> }> {
  return new Promise((resolve, reject) => {
    const fields: Record<string, string> = {};
    const files: Record<string, MultipartField> = {};
    const busboy = Busboy({ headers: req.headers });
    const pending: Promise<void>[] = [];

    busboy.on('field', (name: string, value: string) => {
      fields[name] = value;
    });

    busboy.on('file', (name: string, stream: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
      const tmpPath = join(tmpDir, `${randomUUID()}_${info.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
      const ws = createWriteStream(tmpPath);
      let size = 0;

      stream.on('data', (chunk: Buffer) => { size += chunk.byteLength; });

      const p = new Promise<void>((res, rej) => {
        ws.on('finish', () => {
          files[name] = { originalname: info.filename, mimetype: info.mimeType, filePath: tmpPath, size };
          res();
        });
        ws.on('error', rej);
        stream.on('error', rej);
      });

      pending.push(p);
      stream.pipe(ws);
    });

    busboy.on('finish', () => {
      Promise.all(pending).then(() => resolve({ fields, files })).catch(reject);
    });

    busboy.on('error', reject);
    req.pipe(busboy);
  });
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

function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) {
    return cookies;
  }

  for (const part of cookieHeader.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}

function resolveAcceptLanguageLocale(header: string | string[] | undefined): FrontendLocale | null {
  const rawHeader = Array.isArray(header) ? header.join(',') : header;
  if (!rawHeader) {
    return null;
  }

  const firstSupported = rawHeader
    .split(',')
    .map((part) => part.split(';')[0]?.trim())
    .find((part) => {
      const normalized = part?.toLowerCase() ?? '';
      return normalized === 'pt' || normalized.startsWith('pt-') || normalized === 'en' || normalized.startsWith('en-');
    });

  return firstSupported ? normalizeFrontendLocale(firstSupported) : null;
}

function resolveFrontendRequestLocale(req: IncomingMessage, query: Record<string, string>): FrontendLocale {
  const queryLocale = query.lang ?? query.locale;
  if (queryLocale) {
    return normalizeFrontendLocale(queryLocale);
  }

  const cookies = parseCookieHeader(req.headers.cookie);
  const cookieLocale = cookies.pmp_locale ?? cookies.ytmp_locale;
  if (cookieLocale) {
    return normalizeFrontendLocale(cookieLocale);
  }

  return resolveAcceptLanguageLocale(req.headers['accept-language']) ?? normalizeFrontendLocale(null);
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
        sendOptimizedFrontendBody(req, res, {
          body: frontendAsset.body,
          cacheControl: frontendAssetCacheControl(path, Boolean(query.v)),
          cacheKey: `asset:${path}`,
          contentType: frontendAsset.contentType,
          method,
        });
        return;
      }

      if (isFrontendRoute(path)) {
        const locale = resolveFrontendRequestLocale(req, query);
        const html = renderFrontendDocument(path, locale);
        if (query.lang || query.locale) {
          res.setHeader('set-cookie', serializeCookie({
            name: 'pmp_locale',
            value: encodeURIComponent(locale),
            options: {
              path: '/',
              sameSite: 'Lax',
              maxAge: 60 * 60 * 24 * 365,
            },
          }));
        }
        sendOptimizedFrontendBody(req, res, {
          body: html,
          cacheControl: 'private, max-age=0, must-revalidate',
          cacheKey: `html:${path}:${locale}`,
          contentType: 'text/html; charset=utf-8',
          method,
          vary: 'accept-encoding, accept-language, cookie',
        });
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

    // Multipart streaming upload — bypasses JSON body buffer entirely
    if (method === 'POST' && path === '/api/media') {
      const contentType = req.headers['content-type'] ?? '';
      if (contentType.includes('multipart/form-data')) {
        const tmpDir = join(process.cwd(), 'storage', 'tmp');
        await mkdir(tmpDir, { recursive: true });
        const tmpFiles: string[] = [];
        try {
          const { files, fields } = await parseMultipart(req, tmpDir);
          for (const f of Object.values(files)) tmpFiles.push(f.filePath);

          const multipartBody: Record<string, unknown> = { ...fields };
          if (files.video) {
            multipartBody.video = {
              originalName: files.video.originalname,
              mimeType: files.video.mimetype,
              filePath: files.video.filePath,
              sizeBytes: files.video.size,
            };
            if (fields.videoDuration) {
              (multipartBody.video as Record<string, unknown>).durationSeconds = Number(fields.videoDuration);
            }
          }
          if (files.thumbnail) {
            multipartBody.thumbnail = {
              originalName: files.thumbnail.originalname,
              mimeType: files.thumbnail.mimetype,
              filePath: files.thumbnail.filePath,
              sizeBytes: files.thumbnail.size,
            };
          }

          const httpRequest: HttpRequest = { method, path, session, body: multipartBody, query };
          const httpResponse: HttpResponse = await app.handleRequest(httpRequest);

          res.setHeader('content-type', 'application/json');
          if (httpResponse.cookies?.length) {
            res.setHeader('set-cookie', httpResponse.cookies.map((c: CookieEntry) => serializeCookie(c)));
          }
          res.writeHead(httpResponse.status);
          res.end(JSON.stringify(httpResponse.body));
        } catch (err) {
          for (const f of tmpFiles) await unlink(f).catch(() => {});
          res.setHeader('content-type', 'application/json');
          res.writeHead(500);
          res.end(JSON.stringify({ error: 'Multipart parse error' }));
        }
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

    if (httpResponse.cookies && httpResponse.cookies.length > 0) {
      const serialized = httpResponse.cookies.map((c: CookieEntry) => serializeCookie(c));
      res.setHeader('set-cookie', serialized);
    }

    if (httpResponse.redirect) {
      res.setHeader('Location', httpResponse.redirect);
      res.writeHead(302);
      res.end();
      return;
    }

    res.setHeader('content-type', 'application/json');
    res.writeHead(httpResponse.status);
    res.end(JSON.stringify(httpResponse.body));
  };
}
