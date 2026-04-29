export type PublishErrorClass = 'permanent' | 'transient';

const PERMANENT_PATTERNS: RegExp[] = [
  /\bnot found\b/i,
  /\bmissing\b/i,
  /\binvalid\b/i,
  /\bunauthor/i,
  /\bforbidden\b/i,
  /\bquotaExceeded\b/i,
  /\bquota exceeded\b/i,
  /\bvideoTooLong\b/i,
  /\bvideo too long\b/i,
  /\bvideoNotFound\b/i,
  /\bbadRequest\b/i,
  /\bvalidation\b/i,
  /\bmalformed\b/i,
  /\bdoes not exist\b/i,
  /\b(401|403|404)\b/,
  // TikTok-specific permanent errors
  /\bcontent.policy\b/i,
  /\bcontent policy\b/i,
  /\bcopyright\b/i,
  /\bspam\b/i,
  /\baccount suspended\b/i,
  /\baccount.banned\b/i,
  /\bpermanently.disabled\b/i,
  // Instagram/Meta publishing errors that require user or account action
  /\bOAuthException\b/i,
  /\binvalid_grant\b/i,
  /\binvalid_media_url\b/i,
  /\bmissing_caption\b/i,
  /\bcontainer_not_found\b/i,
  /\bunsupported\b.*\b(format|media|codec)\b/i,
  /\b(media|video)\b.*\b(format|codec)\b.*\bunsupported\b/i,
  /\bcopyright\b/i,
  /\bpolicy violation\b/i,
  /\bviolates\b.*\bpolicy\b/i,
];

const TRANSIENT_PATTERNS: RegExp[] = [
  // Network errors
  /\b429\b/,
  /\brate.limit\b/i,
  /\brate limited\b/i,
  /\btemporarily unavailable\b/i,
  /\bservice unavailable\b/i,
  /\btimeout\b/i,
  /\bconnection refused\b/i,
  /\beconnrefused\b/i,
  /\bECONNREFUSED\b/,
  /\bnetwork error\b/i,
  /\bfailed to fetch\b/i,
  /\b(media\s+)?url\b.*\bnot accessible\b/i,
  /\bprocessing did not finish\b/i,
  /\bcontainer processing timed out\b/i,
];

export function classifyPublishError(error: unknown): PublishErrorClass {
  return classifyPublishErrorMessage(extractMessage(error));
}

export function classifyPublishErrorMessage(message: string | null | undefined): PublishErrorClass {
  if (!message) return 'transient';

  // Check transient patterns first (more specific)
  for (const pattern of TRANSIENT_PATTERNS) {
    if (pattern.test(message)) return 'transient';
  }

  // Check permanent patterns
  for (const pattern of PERMANENT_PATTERNS) {
    if (pattern.test(message)) return 'permanent';
  }

  // Default to transient for unknown errors
  return 'transient';
}

/**
 * Classify TikTok-specific error codes and messages
 */
export function classifyTikTokError(error: unknown): PublishErrorClass {
  // Check if it's a TikTok API error with code
  if (error && typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;
    const code = errorObj.errorCode || errorObj.code;
    const statusCode = errorObj.statusCode || errorObj.status;

    // Check status code first (takes precedence)
    if (statusCode === 429) return 'transient'; // Rate limited
    if (statusCode === 401 || statusCode === 403) return 'permanent'; // Auth errors

    // Check error code
    if (code === '10001' || code === 10001) return 'permanent'; // Invalid access token
    if (code === '10002' || code === 10002) return 'transient'; // Token expired (refresh will retry)
    if (code === 'invalid_grant') return 'permanent'; // Token revoked
    if (code === '429' || code === 'rate_limit_exceeded') return 'transient';
  }

  // Fall back to message-based classification
  return classifyPublishErrorMessage(extractMessage(error));
}

/**
 * Check if error is a TikTok authentication error
 */
export function isTikTokAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const errorObj = error as Record<string, unknown>;
  const code = errorObj.errorCode || errorObj.code;
  const statusCode = errorObj.statusCode || errorObj.status;
  const message = extractMessage(error);

  return (
    code === '10001' ||
    code === 'invalid_grant' ||
    statusCode === 401 ||
    statusCode === 403 ||
    /\binvalid.access.token\b/i.test(message) ||
    /\btoken.revoked\b/i.test(message)
  );
}

/**
 * Check if error is a TikTok rate limit error
 */
export function isTikTokRateLimited(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const errorObj = error as Record<string, unknown>;
  const statusCode = errorObj.statusCode || errorObj.status;
  const code = errorObj.errorCode || errorObj.code;
  const message = extractMessage(error);

  return (
    statusCode === 429 ||
    code === '429' ||
    code === 'rate_limit_exceeded' ||
    /\b429\b/.test(message) ||
    /\brate.limit\b/i.test(message)
  );
}

/**
 * Check if content was rejected due to policy violation
 */
export function isTikTokContentRejected(error: unknown): boolean {
  const message = extractMessage(error);
  return /\b(content.policy|copyright|spam)\b/i.test(message);
}

/**
 * Classify Instagram/Meta Graph API publishing errors.
 */
export function classifyInstagramError(error: unknown): PublishErrorClass {
  if (error && typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;
    const code = errorObj.errorCode || errorObj.code;
    const codeString = typeof code === 'number' ? String(code) : code;
    const statusCode = errorObj.statusCode || errorObj.status;

    if (statusCode === 429) return 'transient';
    if (statusCode === 500 || statusCode === 502 || statusCode === 503 || statusCode === 504) {
      return 'transient';
    }

    if (
      codeString === 'rate_limit_exceeded' ||
      codeString === 'too_many_calls' ||
      codeString === '4' ||
      codeString === '17' ||
      codeString === '32' ||
      codeString === '613'
    ) {
      return 'transient';
    }

    if (
      codeString === 'OAuthException' ||
      codeString === 'invalid_grant' ||
      codeString === 'invalid_media_url' ||
      codeString === 'missing_caption' ||
      codeString === 'container_not_found'
    ) {
      return 'permanent';
    }

    if (statusCode === 400 || statusCode === 401 || statusCode === 403 || statusCode === 404) {
      return 'permanent';
    }
  }

  return classifyPublishErrorMessage(extractMessage(error));
}

/**
 * Check if an Instagram error should send the user through reconnect.
 */
export function isInstagramAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const errorObj = error as Record<string, unknown>;
  const code = errorObj.errorCode || errorObj.code;
  const codeString = typeof code === 'number' ? String(code) : code;
  const statusCode = errorObj.statusCode || errorObj.status;
  const message = extractMessage(error);

  return (
    codeString === 'OAuthException' ||
    codeString === 'invalid_grant' ||
    statusCode === 401 ||
    statusCode === 403 ||
    /\binvalid\b.*\baccess token\b/i.test(message) ||
    /\btoken\b.*\b(revoked|expired)\b/i.test(message)
  );
}

function extractMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
