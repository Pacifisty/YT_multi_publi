export interface AdminSessionUser {
  email: string;
  authenticatedAt: string;
}

export interface AdminSession {
  id?: string;
  adminUser?: AdminSessionUser;
  regenerate?: (callback: (error?: Error) => void) => void;
  destroy?: (callback?: () => void) => void;
}

export interface SessionRequestLike {
  session?: AdminSession | null;
}

export type SessionGuardResult =
  | { allowed: true }
  | { allowed: false; status: 401; reason: 'Unauthorized' };

export class SessionGuard {
  check(request: SessionRequestLike): SessionGuardResult {
    if (request.session?.adminUser?.email) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: 'Unauthorized',
      status: 401,
    };
  }
}
