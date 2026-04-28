export type ErrorClass = 'permanent' | 'transient';

const PERMANENT_PATTERNS = ['invalid', 'unauthorized', 'forbidden', '404', 'not found', 'quota exceeded', 'invalid token', 'invalid credentials'];
const TRANSIENT_PATTERNS = ['timeout', 'connection refused', 'econnreset', 'etimedout', '503', 'temporarily', 'unavailable'];

export function classifyPaymentError(error: unknown): ErrorClass {
  if (!error) {
    return 'transient';
  }

  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  for (const pattern of PERMANENT_PATTERNS) {
    if (lowerMessage.includes(pattern)) {
      return 'permanent';
    }
  }

  for (const pattern of TRANSIENT_PATTERNS) {
    if (lowerMessage.includes(pattern)) {
      return 'transient';
    }
  }

  // Unknown errors default to transient (safe to retry)
  return 'transient';
}
