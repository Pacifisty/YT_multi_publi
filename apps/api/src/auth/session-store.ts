import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from 'node:crypto';
import type { AdminSession } from './session.guard';
import { SESSION_COOKIE_NAME } from '../main';

export interface SessionStoreOptions {
  secret: string;
  maxAgeMs?: number;
}

interface TokenPayload {
  jti: string;
  email: string;
  fullName?: string;
  authenticatedAt: string;
  expiresAt: string;
  needsPlanSelection?: boolean;
  accountDeletionConfirmationMethod?: 'password' | 'email_code' | 'google_reauth';
  accountDeletionRequestedAt?: string;
  accountDeactivationAt?: string;
  accountDeletionAt?: string;
}

const DEFAULT_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const TOKEN_VERSION = 'v2';

/** Encrypted, authenticated and expiring sessions with local revocation. */
export class SessionStore {
  private readonly key: Buffer;
  private readonly maxAgeMs: number;
  private readonly revoked = new Map<string, number>();

  constructor(options: SessionStoreOptions) {
    if (!options.secret) throw new Error('A session secret is required.');
    this.key = createHash('sha256').update(options.secret).digest();
    this.maxAgeMs = options.maxAgeMs ?? DEFAULT_SESSION_MAX_AGE_MS;
  }

  createToken(user: {
    email: string;
    fullName?: string;
    needsPlanSelection?: boolean;
    accountDeletionConfirmationMethod?: 'password' | 'email_code' | 'google_reauth';
    accountDeletionRequestedAt?: string;
    accountDeactivationAt?: string;
    accountDeletionAt?: string;
  }): string {
    const now = new Date();
    const payload: TokenPayload = {
      jti: randomUUID(),
      email: user.email,
      fullName: user.fullName,
      authenticatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + this.maxAgeMs).toISOString(),
      needsPlanSelection: Boolean(user.needsPlanSelection),
      accountDeletionConfirmationMethod: user.accountDeletionConfirmationMethod,
      accountDeletionRequestedAt: user.accountDeletionRequestedAt,
      accountDeactivationAt: user.accountDeactivationAt,
      accountDeletionAt: user.accountDeletionAt,
    };

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(TOKEN_VERSION));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [TOKEN_VERSION, iv.toString('base64url'), ciphertext.toString('base64url'), tag.toString('base64url')].join('.');
  }

  verifyToken(token: string): AdminSession | null {
    const [version, ivEncoded, ciphertextEncoded, tagEncoded, extra] = token.split('.');
    if (version !== TOKEN_VERSION || !ivEncoded || !ciphertextEncoded || !tagEncoded || extra) return null;

    try {
      const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivEncoded, 'base64url'));
      decipher.setAAD(Buffer.from(TOKEN_VERSION));
      decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
        decipher.final(),
      ]).toString('utf8');
      const payload = JSON.parse(plaintext) as TokenPayload;
      const expiresAtMs = Date.parse(payload.expiresAt);
      if (!payload.jti || !payload.email || !Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return null;
      this.cleanupRevocations();
      if (this.revoked.has(payload.jti)) return null;

      return {
        id: payload.jti,
        adminUser: {
          email: payload.email,
          fullName: payload.fullName,
          authenticatedAt: payload.authenticatedAt,
          needsPlanSelection: Boolean(payload.needsPlanSelection),
          accountDeletionConfirmationMethod: payload.accountDeletionConfirmationMethod,
          accountDeletionRequestedAt: payload.accountDeletionRequestedAt,
          accountDeactivationAt: payload.accountDeactivationAt,
          accountDeletionAt: payload.accountDeletionAt,
        },
      };
    } catch {
      return null;
    }
  }

  revokeSession(sessionId: string | undefined): void {
    if (!sessionId) return;
    this.cleanupRevocations();
    this.revoked.set(sessionId, Date.now() + this.maxAgeMs);
  }

  createSessionResolver(): (cookieHeader: string | undefined) => AdminSession | null {
    return (cookieHeader: string | undefined): AdminSession | null => {
      const token = parseCookieHeader(cookieHeader)[SESSION_COOKIE_NAME];
      return token ? this.verifyToken(token) : null;
    };
  }

  private cleanupRevocations(): void {
    const now = Date.now();
    for (const [id, expiresAt] of this.revoked) {
      if (expiresAt <= now) this.revoked.delete(id);
    }
  }
}

export function parseCookieHeader(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  const parsed: Record<string, string> = {};
  for (const item of cookieHeader.split(';')) {
    const separator = item.indexOf('=');
    if (separator <= 0) continue;
    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    if (key) parsed[key] = decodeURIComponent(value);
  }
  return parsed;
}
