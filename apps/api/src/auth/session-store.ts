import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AdminSession } from './session.guard';
import { SESSION_COOKIE_NAME } from '../main';

export interface SessionStoreOptions {
  secret: string;
}

interface TokenPayload {
  email: string;
  fullName?: string;
  authenticatedAt: string;
  needsPlanSelection?: boolean;
}

export class SessionStore {
  private readonly secret: string;

  constructor(options: SessionStoreOptions) {
    this.secret = options.secret;
  }

  createToken(user: { email: string; fullName?: string; needsPlanSelection?: boolean }): string {
    const payload: TokenPayload = {
      email: user.email,
      fullName: user.fullName,
      authenticatedAt: new Date().toISOString(),
      needsPlanSelection: Boolean(user.needsPlanSelection),
    };

    const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = this.sign(data);

    return `${data}.${signature}`;
  }

  verifyToken(token: string): AdminSession | null {
    if (!token) return null;

    const dotIndex = token.indexOf('.');
    if (dotIndex === -1) return null;

    const data = token.slice(0, dotIndex);
    const signature = token.slice(dotIndex + 1);

    const expectedSignature = this.sign(data);

    if (!this.safeCompare(signature, expectedSignature)) {
      return null;
    }

    try {
      const payload: TokenPayload = JSON.parse(
        Buffer.from(data, 'base64url').toString('utf-8'),
      );

      return {
        adminUser: {
          email: payload.email,
          fullName: payload.fullName,
          authenticatedAt: payload.authenticatedAt,
          needsPlanSelection: Boolean(payload.needsPlanSelection),
        },
      };
    } catch {
      return null;
    }
  }

  createSessionResolver(): (cookieHeader: string | undefined) => AdminSession | null {
    return (cookieHeader: string | undefined): AdminSession | null => {
      const cookies = parseCookieHeader(cookieHeader);
      const token = cookies[SESSION_COOKIE_NAME];
      if (!token) return null;
      return this.verifyToken(token);
    };
  }

  private sign(data: string): string {
    return createHmac('sha256', this.secret).update(data).digest('base64url');
  }

  private safeCompare(a: string, b: string): boolean {
    try {
      const bufA = Buffer.from(a);
      const bufB = Buffer.from(b);
      if (bufA.length !== bufB.length) return false;
      return timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }
}

export function parseCookieHeader(
  header: string | undefined,
): Record<string, string> {
  if (!header) return {};

  const cookies: Record<string, string> = {};

  for (const pair of header.split(';')) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) continue;
    const name = pair.slice(0, eqIndex).trim();
    const value = pair.slice(eqIndex + 1).trim();
    cookies[name] = value;
  }

  return cookies;
}
