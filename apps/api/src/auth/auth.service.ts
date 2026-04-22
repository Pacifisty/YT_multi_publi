import { createHash, randomUUID, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import { GoogleOauthService, GOOGLE_AUTH_SCOPES, type GoogleOauthSession } from '../integrations/google/google-oauth.service';
import { getSeedAdminUser } from '../../../../prisma/seed';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { AdminSession, AdminSessionUser } from './session.guard';
import type { AuthUser, AuthUserRepository } from './auth-user.repository';
import { InMemoryAuthUserRepository } from './auth-user.repository';

const scrypt = promisify(nodeScrypt);

export interface AuthServiceOptions {
  env?: Record<string, string | undefined>;
  now?: () => Date;
  userStore?: AuthUserRepository;
  googleOauthService?: GoogleOauthService;
}

export type LoginResult =
  | {
      ok: true;
      user: AdminSessionUser;
      sessionId: string;
      created?: boolean;
    }
  | {
      ok: false;
      status: 400 | 401 | 409 | 429 | 500;
      message: string;
    };

interface FailedAttemptState {
  count: number;
  lockedUntil?: number;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000;

export class AuthService {
  private readonly env: Record<string, string | undefined>;
  private readonly now: () => Date;
  private readonly userStore: AuthUserRepository;
  private readonly googleOauthService: GoogleOauthService;
  private readonly failedAttempts = new Map<string, FailedAttemptState>();
  private readonly googleOauthStates = new Map<string, number>();

  constructor(options: AuthServiceOptions = {}) {
    this.env = options.env ?? process.env;
    this.now = options.now ?? (() => new Date());
    this.userStore = options.userStore ?? new InMemoryAuthUserRepository(buildSeedUsers(this.env));
    this.googleOauthService = options.googleOauthService ?? createAuthGoogleOauthService(this.env);
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

    const user = await this.userStore.findByEmail(loginKey);

    if (!user?.isActive) {
      this.recordFailedAttempt(loginKey);
      return {
        ok: false,
        status: 401,
        message: 'Invalid email or password.',
      };
    }

    if (!user.passwordHash) {
      this.recordFailedAttempt(loginKey);
      return {
        ok: false,
        status: 401,
        message: 'This account uses Google sign-in. Continue with Google to access the platform.',
      };
    }

    const passwordMatches = await verifyPasswordHash(credentials.password, user.passwordHash);
    if (!passwordMatches) {
      this.recordFailedAttempt(loginKey);
      return {
        ok: false,
        status: 401,
        message: 'Invalid email or password.',
      };
    }

    this.failedAttempts.delete(loginKey);
    return this.finalizeAuthenticatedUser(user, session);
  }

  async register(input: RegisterDto, session?: AdminSession | null): Promise<LoginResult> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existing = await this.userStore.findByEmail(normalizedEmail);
    if (existing) {
      return {
        ok: false,
        status: 409,
        message: 'An account with this email already exists.',
      };
    }

    const passwordHash = await createPasswordHash(input.password);
    const user = await this.userStore.create({
      email: normalizedEmail,
      fullName: input.fullName?.trim() || null,
      passwordHash,
      planSelectionCompleted: false,
    });

    const result = await this.finalizeAuthenticatedUser(user, session);
    if (!result.ok) {
      return result;
    }
    return {
      ...result,
      created: true,
    };
  }

  async createGoogleAuthorizationRedirect(session?: GoogleOauthSession | null): Promise<string> {
    const redirectUrl = await this.googleOauthService.createAuthorizationRedirect(
      session,
      GOOGLE_AUTH_SCOPES,
    );
    const state = extractStateFromAuthorizationRedirect(redirectUrl);
    if (state) {
      this.rememberGoogleOauthState(state);
    }
    return redirectUrl;
  }

  async authenticateWithGoogleCallback(
    input: {
      code: string;
      state: string;
      session?: GoogleOauthSession | null;
    },
    session?: AdminSession | null,
  ): Promise<LoginResult> {
    const sessionStateValid = this.googleOauthService.validateCallbackState(input.session, input.state);
    const storedStateValid = this.consumeGoogleOauthState(input.state);
    if (!sessionStateValid && !storedStateValid) {
      return {
        ok: false,
        status: 400,
        message: 'OAuth state validation failed. Please try again.',
      };
    }

    const tokenResult = await this.googleOauthService.exchangeCodeForTokens(input.code);
    const email = tokenResult.profile.email?.trim().toLowerCase();
    if (!email) {
      return {
        ok: false,
        status: 400,
        message: 'Google account did not return a valid email address.',
      };
    }

    const googleSubject = tokenResult.profile.providerSubject ?? tokenResult.profile.googleSubject;
    let existing = googleSubject
      ? await this.userStore.findByGoogleSubject(googleSubject)
      : null;

    if (!existing) {
      existing = await this.userStore.findByEmail(email);
    }

    let user: AuthUser;
    if (!existing) {
      user = await this.userStore.create({
        email,
        fullName: tokenResult.profile.displayName?.trim() || null,
        googleSubject: googleSubject?.trim() || null,
        passwordHash: null,
        planSelectionCompleted: false,
      });
      const result = await this.finalizeAuthenticatedUser(user, session);
      if (!result.ok) {
        return result;
      }
      return {
        ...result,
        created: true,
      };
    }

    const updated = await this.userStore.update(existing.id, {
      email,
      fullName: tokenResult.profile.displayName?.trim() || existing.fullName,
      googleSubject: googleSubject?.trim() || existing.googleSubject,
      updatedAt: this.now(),
    });
    user = updated ?? existing;

    return this.finalizeAuthenticatedUser(user, session);
  }

  getCurrentUser(session?: AdminSession | null): AdminSessionUser | null {
    return session?.adminUser ?? null;
  }

  async markPlanSelectionCompleted(email: string, session?: AdminSession | null): Promise<AdminSessionUser | null> {
    const user = await this.userStore.findByEmail(email);
    if (!user) {
      return null;
    }

    const updated = await this.userStore.update(user.id, {
      planSelectionCompleted: true,
      updatedAt: this.now(),
    });
    const resolved = updated ?? { ...user, planSelectionCompleted: true };
    const sessionUser = this.toSessionUser(resolved);
    if (session) {
      session.adminUser = sessionUser;
    }
    return sessionUser;
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

  private async finalizeAuthenticatedUser(user: AuthUser, session?: AdminSession | null): Promise<LoginResult> {
    try {
      await regenerateSession(session);
    } catch {
      return {
        ok: false,
        status: 500,
        message: 'Unable to create the authenticated session.',
      };
    }

    const sessionUser = this.toSessionUser(user);

    if (session) {
      session.id = session.id ?? randomUUID();
      session.adminUser = sessionUser;
    }

    return {
      ok: true,
      user: sessionUser,
      sessionId: session?.id ?? randomUUID(),
    };
  }

  private toSessionUser(user: AuthUser): AdminSessionUser {
    return {
      email: user.email,
      fullName: user.fullName ?? undefined,
      authenticatedAt: this.now().toISOString(),
      needsPlanSelection: !user.planSelectionCompleted,
    };
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

  private rememberGoogleOauthState(state: string): void {
    this.cleanupExpiredGoogleOauthStates();
    this.googleOauthStates.set(state, this.now().getTime());
  }

  private consumeGoogleOauthState(state: string): boolean {
    this.cleanupExpiredGoogleOauthStates();
    const existing = this.googleOauthStates.get(state);
    if (!existing) {
      return false;
    }
    this.googleOauthStates.delete(state);
    return true;
  }

  private cleanupExpiredGoogleOauthStates(): void {
    const expiresBefore = this.now().getTime() - GOOGLE_STATE_TTL_MS;
    for (const [state, createdAtMs] of this.googleOauthStates.entries()) {
      if (createdAtMs < expiresBefore) {
        this.googleOauthStates.delete(state);
      }
    }
  }
}

function buildSeedUsers(env: Record<string, string | undefined>): AuthUser[] {
  try {
    const seededAdmin = getSeedAdminUser(env);
    return [
      {
        id: randomUUID(),
        email: seededAdmin.email.trim().toLowerCase(),
        fullName: 'Admin',
        passwordHash: seededAdmin.passwordHash,
        googleSubject: null,
        isActive: seededAdmin.isActive,
        planSelectionCompleted: true,
        createdAt: new Date(seededAdmin.createdAt),
        updatedAt: new Date(seededAdmin.createdAt),
      },
    ];
  } catch {
    return [];
  }
}

function createAuthGoogleOauthService(env: Record<string, string | undefined>): GoogleOauthService {
  const redirectUri = env.GOOGLE_AUTH_REDIRECT_URI?.trim()
    || normalizePublicBaseUrl(env);

  return new GoogleOauthService({
    env: {
      ...env,
      GOOGLE_REDIRECT_URI: redirectUri,
    },
  });
}

function normalizePublicBaseUrl(env: Record<string, string | undefined>): string {
  const explicit = env.PUBLIC_APP_URL?.trim();
  if (explicit) {
    return `${explicit.replace(/\/+$/, '')}/login/callback`;
  }

  const host = env.HOST?.trim() || '127.0.0.1';
  const port = env.PORT?.trim() || '3000';
  return `http://${host}:${port}/login/callback`;
}

function extractStateFromAuthorizationRedirect(redirectUrl: string): string | null {
  try {
    const url = new URL(redirectUrl);
    const state = url.searchParams.get('state');
    return state && state.trim() ? state.trim() : null;
  } catch {
    return null;
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

export async function createPasswordHash(password: string): Promise<string> {
  const argon2Hasher = await loadArgon2Hasher();
  if (argon2Hasher) {
    return argon2Hasher(password);
  }

  const salt = randomUUID().replaceAll('-', '');
  const derivedKey = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString('base64url')}`;
}

export async function verifyPasswordHash(password: string, storedHash: string): Promise<boolean> {
  if (storedHash.startsWith('plain:')) {
    return safeEquals(storedHash.slice('plain:'.length), password);
  }

  if (storedHash.startsWith('sha256:')) {
    const digest = createHash('sha256').update(password).digest('hex');
    return safeEquals(storedHash.slice('sha256:'.length), digest);
  }

  if (storedHash.startsWith('scrypt:')) {
    const [, salt, expected] = storedHash.split(':', 3);
    if (!salt || !expected) {
      return false;
    }
    const derivedKey = await scrypt(password, salt, 64) as Buffer;
    return safeEquals(expected, derivedKey.toString('base64url'));
  }

  if (storedHash.startsWith('$argon2')) {
    const verifier = await loadArgon2Verifier();
    return verifier ? verifier(password, storedHash) : false;
  }

  return safeEquals(storedHash, password);
}

async function loadArgon2Hasher(): Promise<((password: string) => Promise<string>) | null> {
  const nodeRsArgon2 = await importOptionalModule<{
    hash: (password: string) => Promise<string>;
  }>('@node-rs/argon2');

  if (nodeRsArgon2?.hash) {
    return (password: string) => nodeRsArgon2.hash(password);
  }

  const argon2 = await importOptionalModule<{
    hash: (password: string) => Promise<string>;
  }>('argon2');

  if (argon2?.hash) {
    return (password: string) => argon2.hash(password);
  }

  return null;
}

async function loadArgon2Verifier(): Promise<((password: string, hash: string) => Promise<boolean>) | null> {
  const nodeRsArgon2 = await importOptionalModule<{ verify: (hash: string, password: string) => Promise<boolean> }>('@node-rs/argon2');

  if (nodeRsArgon2?.verify) {
    return (password: string, hash: string) => nodeRsArgon2.verify(hash, password);
  }

  const argon2 = await importOptionalModule<{ verify: (hash: string, password: string) => Promise<boolean> }>('argon2');

  if (argon2?.verify) {
    return (password: string, hash: string) => argon2.verify(hash, password);
  }

  return null;
}

async function importOptionalModule<TModule>(specifier: string): Promise<TModule | null> {
  try {
    const dynamicImport = new Function('modulePath', 'return import(modulePath);') as (modulePath: string) => Promise<TModule>;
    return await dynamicImport(specifier);
  } catch {
    return null;
  }
}
