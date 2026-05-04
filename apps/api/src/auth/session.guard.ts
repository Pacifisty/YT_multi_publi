export interface AdminSessionUser {
  email: string;
  fullName?: string;
  authenticatedAt?: string;
  needsPlanSelection?: boolean;
  accountDeletionConfirmationMethod?: 'password' | 'email_code';
  accountDeletionRequestedAt?: string;
  accountDeactivationAt?: string;
  accountDeletionAt?: string;
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

export interface SessionGuardOptions {
  allowPendingPlanSelection?: boolean;
}

export class SessionGuard {
  private readonly allowPendingPlanSelection: boolean;

  constructor(options: SessionGuardOptions = {}) {
    this.allowPendingPlanSelection = options.allowPendingPlanSelection ?? false;
  }

  check(request: SessionRequestLike): SessionGuardResult {
    if (request.session?.adminUser?.email) {
      if (isPastIsoDate(request.session.adminUser.accountDeactivationAt)) {
        return {
          allowed: false,
          reason: 'Unauthorized',
          status: 401,
        };
      }

      if (request.session.adminUser.needsPlanSelection && !this.allowPendingPlanSelection) {
        return {
          allowed: false,
          reason: 'Unauthorized',
          status: 401,
        };
      }

      return { allowed: true };
    }

    return {
      allowed: false,
      reason: 'Unauthorized',
      status: 401,
    };
  }
}

function isPastIsoDate(value: string | undefined): boolean {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp <= Date.now();
}
