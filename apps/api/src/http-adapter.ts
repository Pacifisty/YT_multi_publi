import type { IncomingMessage, ServerResponse } from 'node:http';
import { appendFile, readFile, mkdir, readdir, stat, unlink, writeFile } from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
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
const MAX_JSON_BODY_BYTES = 1 * 1024 * 1024;
const MAX_MULTIPART_FILE_BYTES = 2 * 1024 * 1024 * 1024;
const MEDIA_CHUNK_SIZE_BYTES = 16 * 1024 * 1024;
const MEDIA_CHUNK_MAX_BYTES = MEDIA_CHUNK_SIZE_BYTES + 1024;
const MEDIA_CHUNK_UPLOAD_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CONCURRENT_UPLOADS_PER_OWNER = 3;
const DEFAULT_USER_STORAGE_QUOTA_BYTES = 20 * 1024 * 1024 * 1024;
const frontendContentCache = new Map<string, CachedFrontendContent>();

class PayloadTooLargeError extends Error {
  readonly statusCode = 413;

  constructor(message: string) {
    super(message);
    this.name = 'PayloadTooLargeError';
  }
}

interface ChunkedMediaUpload {
  id: string;
  ownerEmail: string;
  originalName: string;
  mimeType: string;
  totalSize: number;
  totalChunks: number;
  durationSeconds?: number;
  createdAt: number;
  chunkPaths: Map<number, string>;
  chunkSizes: Map<number, number>;
}

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
  if (opts.maxAge !== undefined) str += `; Max-Age=${Math.max(0, Math.floor(opts.maxAge / 1000))}`;
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
    const busboy = Busboy({
      headers: req.headers,
      limits: { files: 2, fields: 20, fieldSize: 64 * 1024, fileSize: MAX_MULTIPART_FILE_BYTES },
    });
    const pending: Promise<void>[] = [];
    let failed = false;
    const fail = (error: Error): void => {
      if (failed) return;
      failed = true;
      reject(error);
    };

    busboy.on('field', (name: string, value: string) => {
      fields[name] = value;
    });

    busboy.on('file', (name: string, stream: NodeJS.ReadableStream, info: { filename: string; encoding: string; mimeType: string }) => {
      const tmpPath = join(tmpDir, `${randomUUID()}_${info.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
      const ws = createWriteStream(tmpPath);
      let size = 0;

      stream.on('data', (chunk: Buffer) => { size += chunk.byteLength; });
      stream.on('limit', () => {
        ws.destroy();
        void unlink(tmpPath).catch(() => {});
        fail(new PayloadTooLargeError('Uploaded file exceeds the maximum allowed size.'));
      });

      const p = new Promise<void>((res, rej) => {
        ws.on('finish', () => {
          files[name] = { originalname: info.filename, mimetype: info.mimeType, filePath: tmpPath, size };
          res();
        });
        ws.on('error', (error) => { rej(error); fail(error); });
        stream.on('error', (error) => { rej(error); fail(error); });
      });

      pending.push(p);
      stream.pipe(ws);
    });

    busboy.on('finish', () => {
      Promise.all(pending).then(() => {
        if (!failed) resolve({ fields, files });
      }).catch(fail);
    });

    busboy.on('filesLimit', () => fail(new Error('Too many uploaded files.')));
    busboy.on('fieldsLimit', () => fail(new Error('Too many multipart fields.')));
    busboy.on('error', fail);
    req.pipe(busboy);
  });
}

function readBody(req: IncomingMessage, maxBytes = MAX_JSON_BODY_BYTES): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;
    req.on('data', (chunk: Buffer) => {
      if (settled) return;
      totalBytes += chunk.byteLength;
      if (totalBytes > maxBytes) {
        settled = true;
        chunks.length = 0;
        reject(new PayloadTooLargeError('Request body exceeds the maximum allowed size.'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!settled) resolve(Buffer.concat(chunks).toString('utf-8'));
    });
    req.on('error', (error) => {
      if (!settled) reject(error);
    });
  });
}

function readBinaryBody(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let settled = false;

    req.on('data', (chunk: Buffer) => {
      if (settled) return;
      totalBytes += chunk.byteLength;
      if (totalBytes > maxBytes) {
        settled = true;
        chunks.length = 0;
        reject(new PayloadTooLargeError('Chunk exceeds the maximum allowed size.'));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!settled) resolve(Buffer.concat(chunks));
    });
    req.on('error', (error) => {
      if (!settled) reject(error);
    });
  });
}

function normalizeUploadOwnerEmail(session: AdminSession | null): string {
  return session?.adminUser?.email?.trim().toLowerCase() ?? '';
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('pragma', 'no-cache');
  res.writeHead(status);
  res.end(JSON.stringify(body));
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

async function streamMediaFile(
  req: IncomingMessage,
  res: ServerResponse,
  method: string,
  absolutePath: string,
  mimeType: string,
  cacheControl: string,
): Promise<boolean> {
  let size: number;
  try {
    size = (await stat(absolutePath)).size;
  } catch {
    return false;
  }

  const rangeHeader = Array.isArray(req.headers.range) ? req.headers.range[0] : req.headers.range;
  const range = parseByteRange(rangeHeader, size);
  if (rangeHeader && !range) {
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.setHeader('content-range', `bytes */${size}`);
    res.writeHead(416);
    res.end(method === 'HEAD' ? undefined : 'Invalid range.');
    return true;
  }

  const start = range?.start ?? 0;
  const end = range?.end ?? Math.max(0, size - 1);
  res.setHeader('content-type', mimeType || 'application/octet-stream');
  res.setHeader('cache-control', cacheControl);
  res.setHeader('accept-ranges', 'bytes');
  res.setHeader('content-length', String(size === 0 ? 0 : end - start + 1));
  if (range) {
    res.setHeader('content-range', `bytes ${start}-${end}/${size}`);
    res.writeHead(206);
  } else {
    res.writeHead(200);
  }

  if (method === 'HEAD' || size === 0) {
    res.end();
    return true;
  }

  // Small test adapters and embedders may expose only `end`; the actual Node
  // response always takes the streaming branch below.
  if (typeof res.write !== 'function') {
    const chunks: Buffer[] = [];
    for await (const chunk of createReadStream(absolutePath, { start, end })) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    res.end(Buffer.concat(chunks));
    return true;
  }

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const stream = createReadStream(absolutePath, { start, end });
    stream.on('error', () => {
      if (!res.headersSent) res.writeHead(500);
      if (typeof res.destroy === 'function') res.destroy();
      else res.end();
      finish();
    });
    res.once('finish', finish);
    res.once('close', finish);
    stream.pipe(res);
  });
  return true;
}

export function createRequestHandler(
  options: RequestHandlerOptions,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const { app, sessionResolver } = options;
  const chunkedUploads = new Map<string, ChunkedMediaUpload>();
  const activeMultipartUploads = new Map<string, number>();
  const userStorageQuotaBytes = parsePositiveByteLimit(
    process.env.MEDIA_USER_STORAGE_QUOTA_BYTES,
    DEFAULT_USER_STORAGE_QUOTA_BYTES,
  );
  const chunkTempDir = join(process.cwd(), 'storage', 'tmp', 'chunks');
  void cleanupOrphanedChunkFiles(chunkTempDir);

  const getStoredBytes = async (ownerEmail: string): Promise<number> => {
    const mediaService = app.mediaModule?.mediaService;
    if (!mediaService || typeof mediaService.listAssets !== 'function') return 0;
    const result = await mediaService.listAssets(ownerEmail);
    return result.assets.reduce((total, asset) => total + Math.max(0, Number(asset.size_bytes) || 0), 0);
  };

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
              maxAge: 60 * 60 * 24 * 365 * 1000,
              secure: process.env.NODE_ENV === 'production',
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

    const ownerEmail = normalizeUploadOwnerEmail(session);
    const chunkInitPath = path === '/api/media/chunked/init';
    const chunkPartMatch = path.match(/^\/api\/media\/chunked\/([0-9a-f-]{36})\/(\d+)$/i);
    const chunkCompleteMatch = path.match(/^\/api\/media\/chunked\/([0-9a-f-]{36})\/complete$/i);

    if (method === 'POST' && chunkInitPath) {
      if (!ownerEmail) {
        sendJson(res, 401, { error: 'Authentication required.' });
        return;
      }

      try {
        await cleanupOrphanedChunkFiles(chunkTempDir);
        const raw = await readBody(req);
        const payload = JSON.parse(raw || '{}') as Record<string, unknown>;
        const originalName = typeof payload.originalName === 'string' ? payload.originalName.trim() : '';
        const mimeType = typeof payload.mimeType === 'string' ? payload.mimeType.trim() : '';
        const totalSize = Number(payload.totalSize);
        const durationSeconds = Number(payload.durationSeconds);
        if (!originalName || !['video/mp4', 'video/quicktime'].includes(mimeType)) {
          sendJson(res, 400, { error: 'Invalid video name or type.' });
          return;
        }
        if (!Number.isInteger(totalSize) || totalSize <= 0 || totalSize > 2 * 1024 * 1024 * 1024) {
          sendJson(res, 400, { error: 'Video size must be between 1 byte and 2 GB.' });
          return;
        }

        const now = Date.now();
        for (const [id, upload] of chunkedUploads.entries()) {
          if (now - upload.createdAt > MEDIA_CHUNK_UPLOAD_TTL_MS) {
            chunkedUploads.delete(id);
            for (const chunkPath of upload.chunkPaths.values()) void unlink(chunkPath).catch(() => {});
          }
        }

        const activeForOwner = [...chunkedUploads.values()].filter((candidate) => candidate.ownerEmail === ownerEmail);
        if (activeForOwner.length + (activeMultipartUploads.get(ownerEmail) ?? 0) >= MAX_CONCURRENT_UPLOADS_PER_OWNER) {
          sendJson(res, 429, { error: 'Too many concurrent uploads for this account.' });
          return;
        }
        const reservedBytes = activeForOwner.reduce((sum, candidate) => sum + candidate.totalSize, 0);
        if (await getStoredBytes(ownerEmail) + reservedBytes + totalSize > userStorageQuotaBytes) {
          sendJson(res, 413, { error: 'Account storage quota exceeded.' });
          return;
        }

        const id = randomUUID();
        const upload: ChunkedMediaUpload = {
          id,
          ownerEmail,
          originalName,
          mimeType,
          totalSize,
          totalChunks: Math.ceil(totalSize / MEDIA_CHUNK_SIZE_BYTES),
          durationSeconds: Number.isFinite(durationSeconds) && durationSeconds >= 0 ? durationSeconds : undefined,
          createdAt: now,
          chunkPaths: new Map(),
          chunkSizes: new Map(),
        };
        chunkedUploads.set(id, upload);
        sendJson(res, 201, { uploadId: id, chunkSize: MEDIA_CHUNK_SIZE_BYTES, totalChunks: upload.totalChunks });
      } catch (error) {
        sendJson(res, error instanceof PayloadTooLargeError ? 413 : 400, {
          error: error instanceof PayloadTooLargeError ? error.message : 'Invalid chunked upload request.',
        });
      }
      return;
    }

    if (method === 'PUT' && chunkPartMatch) {
      if (!ownerEmail) {
        sendJson(res, 401, { error: 'Authentication required.' });
        return;
      }

      const upload = chunkedUploads.get(chunkPartMatch[1]);
      const chunkIndex = Number(chunkPartMatch[2]);
      if (!upload || upload.ownerEmail !== ownerEmail) {
        sendJson(res, 404, { error: 'Chunked upload was not found.' });
        return;
      }
      if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || chunkIndex >= upload.totalChunks) {
        sendJson(res, 400, { error: 'Invalid chunk index.' });
        return;
      }

      try {
        const chunk = await readBinaryBody(req, MEDIA_CHUNK_MAX_BYTES);
        const expectedSize = chunkIndex === upload.totalChunks - 1
          ? upload.totalSize - (chunkIndex * MEDIA_CHUNK_SIZE_BYTES)
          : MEDIA_CHUNK_SIZE_BYTES;
        if (chunk.byteLength !== expectedSize) {
          sendJson(res, 400, { error: `Invalid chunk size. Expected ${expectedSize} bytes.` });
          return;
        }
        await mkdir(chunkTempDir, { recursive: true });
        const chunkPath = join(chunkTempDir, `${upload.id}.${chunkIndex}.part`);
        await writeFile(chunkPath, chunk);
        upload.chunkPaths.set(chunkIndex, chunkPath);
        upload.chunkSizes.set(chunkIndex, chunk.byteLength);
        sendJson(res, 200, { received: chunkIndex, uploadedBytes: [...upload.chunkSizes.values()].reduce((sum, size) => sum + size, 0) });
      } catch (error) {
        sendJson(res, error instanceof PayloadTooLargeError ? 413 : 400, {
          error: error instanceof Error ? error.message : 'Unable to store upload chunk.',
        });
      }
      return;
    }

    if (method === 'POST' && chunkCompleteMatch) {
      if (!ownerEmail) {
        sendJson(res, 401, { error: 'Authentication required.' });
        return;
      }

      const upload = chunkedUploads.get(chunkCompleteMatch[1]);
      if (!upload || upload.ownerEmail !== ownerEmail) {
        sendJson(res, 404, { error: 'Chunked upload was not found.' });
        return;
      }
      if (upload.chunkPaths.size !== upload.totalChunks) {
        sendJson(res, 409, { error: `Upload incomplete. Received ${upload.chunkPaths.size} of ${upload.totalChunks} chunks.` });
        return;
      }

      const tmpDir = join(process.cwd(), 'storage', 'tmp');
      await mkdir(tmpDir, { recursive: true });
      const assembledPath = join(tmpDir, `${upload.id}_${upload.originalName.replace(/[^a-zA-Z0-9._-]/g, '_')}`);
      try {
        const raw = await readBody(req);
        const completion = raw ? JSON.parse(raw) as Record<string, unknown> : {};
        await writeFile(assembledPath, Buffer.alloc(0));
        let assembledSize = 0;
        for (let index = 0; index < upload.totalChunks; index += 1) {
          const chunkPath = upload.chunkPaths.get(index);
          if (!chunkPath) throw new Error(`Missing chunk ${index}.`);
          const chunk = await readFile(chunkPath);
          assembledSize += chunk.byteLength;
          await appendFile(assembledPath, chunk);
          await unlink(chunkPath).catch(() => {});
        }
        if (assembledSize !== upload.totalSize) {
          throw new Error(`Assembled video size mismatch. Expected ${upload.totalSize}, received ${assembledSize}.`);
        }

        const body: Record<string, unknown> = {
          video: {
            originalName: upload.originalName,
            mimeType: upload.mimeType,
            filePath: assembledPath,
            sizeBytes: assembledSize,
            durationSeconds: upload.durationSeconds,
          },
        };
        if (completion.thumbnail && typeof completion.thumbnail === 'object') {
          body.thumbnail = completion.thumbnail;
        }

        const httpResponse = await app.handleRequest({ method: 'POST', path: '/api/media', session, body, query: {} });
        chunkedUploads.delete(upload.id);
        if (httpResponse.status < 200 || httpResponse.status >= 300) {
          await unlink(assembledPath).catch(() => {});
        }
        sendJson(res, httpResponse.status, httpResponse.body);
      } catch (error) {
        chunkedUploads.delete(upload.id);
        await unlink(assembledPath).catch(() => {});
        for (const chunkPath of upload.chunkPaths.values()) await unlink(chunkPath).catch(() => {});
        sendJson(res, 500, { error: error instanceof Error ? error.message : 'Unable to assemble uploaded video.' });
      }
      return;
    }

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

        const streamed = await streamMediaFile(
          req,
          res,
          method,
          mediaFile.absolute_path,
          mediaFile.asset.mime_type,
          'private, max-age=60',
        );
        if (!streamed) {
          res.setHeader('content-type', 'text/plain; charset=utf-8');
          res.writeHead(404);
          res.end(method === 'HEAD' ? undefined : 'Asset file not found.');
        }
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

        const mediaFile = await app.mediaModule.mediaService.getAssetFile(
          mediaFileId,
          session.adminUser.email,
        );
        if (!mediaFile) {
          res.setHeader('content-type', 'text/plain; charset=utf-8');
          res.writeHead(404);
          res.end(method === 'HEAD' ? undefined : 'Asset not found.');
          return;
        }

        const streamed = await streamMediaFile(
          req,
          res,
          method,
          mediaFile.absolute_path,
          mediaFile.asset.mime_type,
          'no-cache',
        );
        if (!streamed) {
          res.setHeader('content-type', 'text/plain; charset=utf-8');
          res.writeHead(404);
          res.end(method === 'HEAD' ? undefined : 'Asset file not found.');
        }
        return;
      }
    }

    // Multipart streaming upload — bypasses JSON body buffer entirely
    if (method === 'POST' && path === '/api/media') {
      const contentType = req.headers['content-type'] ?? '';
      if (contentType.includes('multipart/form-data')) {
        if (!ownerEmail) {
          sendJson(res, 401, { error: 'Authentication required.' });
          return;
        }
        const activeCount = activeMultipartUploads.get(ownerEmail) ?? 0;
        const activeChunkedCount = [...chunkedUploads.values()].filter((upload) => upload.ownerEmail === ownerEmail).length;
        if (activeCount + activeChunkedCount >= MAX_CONCURRENT_UPLOADS_PER_OWNER) {
          sendJson(res, 429, { error: 'Too many concurrent uploads for this account.' });
          return;
        }
        activeMultipartUploads.set(ownerEmail, activeCount + 1);
        const tmpDir = join(process.cwd(), 'storage', 'tmp');
        await mkdir(tmpDir, { recursive: true });
        const tmpFiles: string[] = [];
        try {
          const { files, fields } = await parseMultipart(req, tmpDir);
          for (const f of Object.values(files)) tmpFiles.push(f.filePath);
          const incomingBytes = Object.values(files).reduce((sum, file) => sum + file.size, 0);
          if (await getStoredBytes(ownerEmail) + incomingBytes > userStorageQuotaBytes) {
            throw new PayloadTooLargeError('Account storage quota exceeded.');
          }

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

          const httpRequest: HttpRequest = { method, path, session, body: multipartBody, query, headers: req.headers };
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
          res.writeHead(err instanceof PayloadTooLargeError ? 413 : 400);
          res.end(JSON.stringify({ error: err instanceof PayloadTooLargeError ? err.message : 'Invalid multipart upload.' }));
        } finally {
          const remaining = (activeMultipartUploads.get(ownerEmail) ?? 1) - 1;
          if (remaining > 0) activeMultipartUploads.set(ownerEmail, remaining);
          else activeMultipartUploads.delete(ownerEmail);
        }
        return;
      }
    }

    let body: unknown = undefined;
    let rawBody: string | undefined;

    if (method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE') {
      const raw = await readBody(req);
      rawBody = raw;
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

    const httpRequest: HttpRequest = { method, path, session, body, query, headers: req.headers, rawBody };
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

function parsePositiveByteLimit(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function cleanupOrphanedChunkFiles(directory: string): Promise<void> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
    return;
  }
  const expiresBefore = Date.now() - MEDIA_CHUNK_UPLOAD_TTL_MS;
  await Promise.all(entries.map(async (entry) => {
    if (!entry.isFile() || !entry.name.endsWith('.part')) return;
    const absolutePath = join(directory, entry.name);
    try {
      if ((await stat(absolutePath)).mtimeMs < expiresBefore) await unlink(absolutePath);
    } catch {
      // A concurrent upload/cleanup may already have removed the part.
    }
  }));
}
