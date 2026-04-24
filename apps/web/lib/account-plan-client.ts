import type { AuthFetch } from './auth-client';
import type { AuthenticatedUser } from './auth-client';

export type AccountPlanType = 'FREE' | 'BASIC' | 'PRO';
export type AccountDepthProfile = 'light' | 'balanced' | 'deep';

export interface AccountPlanSummary {
  email: string;
  plan: AccountPlanType;
  planLabel: string;
  tokens: number;
  maxTokens: number;
  dailyVisitTokens: number;
  campaignPublishCostTokens: number;
  priceBrl: number | null;
  durationDays: number | null;
  billingStartedAt: string | null;
  billingExpiresAt: string | null;
  expiresSoon: boolean;
  dailyVisitClaimedToday: boolean;
  monthlyGrantClaimedThisMonth: boolean;
  allowedPlatforms: string[];
  depthProfile: AccountDepthProfile;
}

export interface AccountPlanMutationResult {
  account: AccountPlanSummary;
  user?: AuthenticatedUser;
}

interface AccountPlanResponseBody {
  error?: string;
  account?: AccountPlanSummary;
  user?: Partial<AuthenticatedUser>;
  claimed?: boolean;
  grantedTokens?: number;
}

function parseAuthenticatedUser(value?: Partial<AuthenticatedUser>): AuthenticatedUser | undefined {
  if (!value?.email) {
    return undefined;
  }

  return {
    email: value.email,
    fullName: value.fullName,
    needsPlanSelection: Boolean(value.needsPlanSelection),
  };
}

async function request(
  fetcher: AuthFetch,
  method: string,
  url: string,
  body?: unknown,
): Promise<{ status: number; body: AccountPlanResponseBody }> {
  const init: Parameters<AuthFetch>[1] = {
    method,
    credentials: 'include',
  };

  if (body !== undefined) {
    init.headers = {
      'content-type': 'application/json',
    };
    init.body = JSON.stringify(body);
  }

  const response = await fetcher(url, init);
  return {
    status: response.status,
    body: (await response.json()) as AccountPlanResponseBody,
  };
}

export async function getAccountPlanSummary(
  fetcher: AuthFetch = globalThis.fetch as AuthFetch,
): Promise<{ ok: true; account: AccountPlanSummary } | { ok: false; status: number; error: string }> {
  const response = await request(fetcher, 'GET', '/api/account/plan');

  if (response.status !== 200 || !response.body.account) {
    return {
      ok: false,
      status: response.status,
      error: response.body.error ?? 'Unable to load the current plan.',
    };
  }

  return {
    ok: true,
    account: response.body.account,
  };
}

export async function selectAccountPlan(
  plan: AccountPlanType,
  fetcher: AuthFetch = globalThis.fetch as AuthFetch,
): Promise<{ ok: true; result: AccountPlanMutationResult } | { ok: false; status: number; error: string }> {
  const response = await request(fetcher, 'POST', '/api/account/plan/select', { plan });

  if (response.status !== 200 || !response.body.account) {
    return {
      ok: false,
      status: response.status,
      error: response.body.error ?? 'Unable to update the selected plan.',
    };
  }

  return {
    ok: true,
    result: {
      account: response.body.account,
      user: parseAuthenticatedUser(response.body.user),
    },
  };
}

export async function claimDailyVisitTokens(
  fetcher: AuthFetch = globalThis.fetch as AuthFetch,
): Promise<{ ok: true; claimed: boolean; grantedTokens: number; account: AccountPlanSummary } | { ok: false; status: number; error: string }> {
  const response = await request(fetcher, 'POST', '/api/account/plan/visit');

  if (response.status !== 200 || !response.body.account) {
    return {
      ok: false,
      status: response.status,
      error: response.body.error ?? 'Unable to claim the daily visit bonus.',
    };
  }

  return {
    ok: true,
    claimed: Boolean(response.body.claimed),
    grantedTokens: Number(response.body.grantedTokens ?? 0),
    account: response.body.account,
  };
}

export async function claimMonthlyGrantTokens(
  fetcher: AuthFetch = globalThis.fetch as AuthFetch,
): Promise<{ ok: true; claimed: boolean; grantedTokens: number; account: AccountPlanSummary } | { ok: false; status: number; error: string }> {
  const response = await request(fetcher, 'POST', '/api/account/plan/monthly');

  if (response.status !== 200 || !response.body.account) {
    return {
      ok: false,
      status: response.status,
      error: response.body.error ?? 'Unable to claim the monthly grant.',
    };
  }

  return {
    ok: true,
    claimed: Boolean(response.body.claimed),
    grantedTokens: Number(response.body.grantedTokens ?? 0),
    account: response.body.account,
  };
}
