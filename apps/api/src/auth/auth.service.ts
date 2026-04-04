import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';

import { getSeedAdminUser } from '../../../../prisma/seed';
import type { LoginDto } from './dto/login.dto';
import type { AdminSession, AdminSessionUser } from './session.guard';

export interface AuthServiceOptions {
  env?: Record<string, string | undefined>;
  now?: () => Date;
}

export type LoginResult =
  | {
      ok: true;
      user: AdminSessionUser;
      sessionId: string;
    }
  | {
      ok: false;
      status: 401 | 429;
      message: string;
    };

interface FailedAttemptState {
  count: number;
  lockedUntil?: number;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

export class AuthService {
  private readonly env: Record<string, string | undefined>;
  private readonly now: () => Date;
  private readonly failedAttempts = new Map<string, FailedAttemptState>();

  constructor(options: AuthServiceOptions = {}) {
    this.env = options.env ?? process.env;
    this.now = options.now ?? (() => new Date());
  }

  async login(credentials: LoginDto, session?: AdminSession | null): Promise<LoginResult> {
    const loginKey = credentials.email.trim().toLowerCase();
    const rateLimitMessage = this.getRateLimitMessage(loginKey);

    if (rateLimitMessage) {
      return {
        ok: false,
        status: 429,
        message: rateLimitMessage,
      };
    }

    const seededAdmin = getSeedAdminUser(this.env);
    const emailMatches = seededAdmin.email.trim().toLowerCase() === loginKey;
    const passwordMatches = await verifyPasswordHash(credentials.password, seededAdmin.passwordHash);

    if (!emailMatches || !passwordMatches) {
      this.recordFailedAttempt(loginKey);
      return {
        ok: false,
        status: 401,
        message: 'Invalid email or password.',
      };
    }

    this.failedAttempts.delete(loginKey);
    await regenerateSession(session);

    const user: AdminSessionUser = {
      email: seededAdmin.email,
      authenticatedAt: this.now().toISOString(),
    };

    if (session) {
      session.id = session.id ?? randomUUID();
      session.adminUser = user;
    }

    return {
      ok: true,
      user,
      sessionId: session?.id ?? randomUUID(),
    };
  }

  getCurrentUser(session?: AdminSession | null): AdminSessionUser | null {
    return session?.adminUser ?? null;
  }

  async logout(session?: AdminSession | null): Promise<void> {
    if (!session?.destroy) {
      if (session) {
        delete session.adminUser;
      }
      return;
    }

    await new Promise<void>((resolve) => {
      session.destroy?.(() => resolve());
    });
  }

  private getRateLimitMessage(loginKey: string): string | null {
    const currentState = this.failedAttempts.get(loginKey);

    if (!currentState?.lockedUntil) {
      return null;
    }

    return currentState.lockedUntil > this.now().getTime()
      ? 'Too many login attempts. Please wait and try again.'
      : null;
  }

  private recordFailedAttempt(loginKey: string): void {
    const currentState = this.failedAttempts.get(loginKey) ?? { count: 0 };
    const nextCount = currentState.count + 1;

    this.failedAttempts.set(loginKey, {
      count: nextCount,
      lockedUntil: nextCount >= MAX_FAILED_ATTEMPTS ? this.now().getTime() + LOCKOUT_WINDOW_MS : undefined,
    });
  }
}

async function regenerateSession(session?: AdminSession | null): Promise<void> {
  if (!session?.regenerate) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    session.regenerate?.((error?: Error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function safeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export async function verifyPasswordHash(password: string, storedHash: string): Promise<boolean> {
  if (storedHash.startsWith('plain:')) {
    return safeEquals(storedHash.slice('plain:'.length), password);
  }

  if (storedHash.startsWith('sha256:')) {
    const digest = createHash('sha256').update(password).digest('hex');
    return safeEquals(storedHash.slice('sha256:'.length), digest);
  }

  if (storedHash.startsWith('$argon2')) {
    const verifier = await loadArgon2Verifier();
    return verifier ? verifier(password, storedHash) : false;
  }

  return safeEquals(storedHash, password);
}

async function loadArgon2Verifier(): Promise<((password: string, hash: string) => Promise<boolean>) | null> {
  try {
    const nodeRsArgon2 = await import('@node-rs/argon2');
    return (password: string, hash: string) => nodeRsArgon2.verify(hash, password);
  } catch {
    try {
      const argon2 = await import('argon2');
      return (password: string, hash: string) => argon2.verify(hash, password);
    } catch {
      return null;
    }
  }
}
