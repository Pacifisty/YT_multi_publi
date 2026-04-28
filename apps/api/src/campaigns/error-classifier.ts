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
];

export function classifyPublishError(error: unknown): PublishErrorClass {
  return classifyPublishErrorMessage(extractMessage(error));
}

export function classifyPublishErrorMessage(message: string | null | undefined): PublishErrorClass {
  if (!message) return 'transient';
  for (const pattern of PERMANENT_PATTERNS) {
    if (pattern.test(message)) return 'permanent';
  }
  return 'transient';
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
