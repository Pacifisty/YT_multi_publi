export type TikTokPublishQuotaLimit = 'minute' | 'day';

export interface TikTokPublishQuotaDecision {
  allowed: boolean;
  limit?: TikTokPublishQuotaLimit;
  retryAfter?: Date;
  message?: string;
}

export interface TikTokPublishQuotaTracker {
  canPublish(connectedAccountId: string): TikTokPublishQuotaDecision;
  recordPublish(connectedAccountId: string): void;
}

export interface InMemoryTikTokPublishQuotaTrackerOptions {
  maxPerMinute?: number;
  maxPerDay?: number;
  now?: () => Date;
}

const DEFAULT_MAX_PER_MINUTE = 6;
const DEFAULT_MAX_PER_DAY = 15;
const ONE_MINUTE_MS = 60_000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export class InMemoryTikTokPublishQuotaTracker implements TikTokPublishQuotaTracker {
  private readonly maxPerMinute: number;
  private readonly maxPerDay: number;
  private readonly now: () => Date;
  private readonly publishedAtByAccount = new Map<string, number[]>();

  constructor(options: InMemoryTikTokPublishQuotaTrackerOptions = {}) {
    this.maxPerMinute = options.maxPerMinute ?? DEFAULT_MAX_PER_MINUTE;
    this.maxPerDay = options.maxPerDay ?? DEFAULT_MAX_PER_DAY;
    this.now = options.now ?? (() => new Date());
  }

  canPublish(connectedAccountId: string): TikTokPublishQuotaDecision {
    const accountId = normalizeAccountId(connectedAccountId);
    const nowMs = this.now().getTime();
    const timestamps = this.getRecentTimestamps(accountId, nowMs);
    const dayStart = getUtcDayStartMs(nowMs);
    const dayEnd = dayStart + ONE_DAY_MS;

    if (timestamps.filter((timestamp) => timestamp >= dayStart && timestamp < dayEnd).length >= this.maxPerDay) {
      return {
        allowed: false,
        limit: 'day',
        retryAfter: new Date(dayEnd),
        message: `TikTok daily publish quota reached for ${accountId}. Retry after ${new Date(dayEnd).toISOString()}.`,
      };
    }

    const minuteCutoff = nowMs - ONE_MINUTE_MS;
    if (timestamps.filter((timestamp) => timestamp > minuteCutoff).length >= this.maxPerMinute) {
      const oldestInWindow = timestamps
        .filter((timestamp) => timestamp > minuteCutoff)
        .sort((left, right) => left - right)[0];
      const retryAfterMs = (oldestInWindow ?? nowMs) + ONE_MINUTE_MS;

      return {
        allowed: false,
        limit: 'minute',
        retryAfter: new Date(retryAfterMs),
        message: `TikTok per-minute publish quota reached for ${accountId}. Retry after ${new Date(retryAfterMs).toISOString()}.`,
      };
    }

    return { allowed: true };
  }

  recordPublish(connectedAccountId: string): void {
    const accountId = normalizeAccountId(connectedAccountId);
    const nowMs = this.now().getTime();
    const timestamps = this.getRecentTimestamps(accountId, nowMs);
    timestamps.push(nowMs);
    this.publishedAtByAccount.set(accountId, timestamps);
  }

  getUsage(connectedAccountId: string): { minute: number; day: number } {
    const accountId = normalizeAccountId(connectedAccountId);
    const nowMs = this.now().getTime();
    const timestamps = this.getRecentTimestamps(accountId, nowMs);
    const dayStart = getUtcDayStartMs(nowMs);
    const dayEnd = dayStart + ONE_DAY_MS;
    const minuteCutoff = nowMs - ONE_MINUTE_MS;

    return {
      minute: timestamps.filter((timestamp) => timestamp > minuteCutoff).length,
      day: timestamps.filter((timestamp) => timestamp >= dayStart && timestamp < dayEnd).length,
    };
  }

  reset(): void {
    this.publishedAtByAccount.clear();
  }

  private getRecentTimestamps(accountId: string, nowMs: number): number[] {
    const dayStart = getUtcDayStartMs(nowMs);
    const timestamps = (this.publishedAtByAccount.get(accountId) ?? [])
      .filter((timestamp) => timestamp >= dayStart);

    this.publishedAtByAccount.set(accountId, timestamps);
    return timestamps;
  }
}

function normalizeAccountId(connectedAccountId: string): string {
  const normalized = connectedAccountId.trim();
  return normalized || 'unknown-account';
}

function getUtcDayStartMs(timestamp: number): number {
  const date = new Date(timestamp);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}
