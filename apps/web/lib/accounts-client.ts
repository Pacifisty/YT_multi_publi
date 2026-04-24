import type { AuthFetch } from './auth-client';

export type SupportedOauthProvider = 'google' | 'youtube' | 'tiktok';

export interface ConnectedAccountRecord {
  id: string;
  provider: SupportedOauthProvider | string;
  email?: string;
  displayName?: string;
  status?: string;
  scopes?: string[];
  tokenExpiresAt?: string | null;
  connectedAt?: string;
  updatedAt?: string;
}

export interface AccountOauthCallbackResult {
  account: ConnectedAccountRecord;
  sync?: {
    channelCount: number;
    message: string;
  };
}

interface AccountsResponseBody {
  error?: string;
  redirectUrl?: string;
  account?: ConnectedAccountRecord;
  sync?: {
    channelCount: number;
    message: string;
  };
}

function buildUrl(path: string, query?: Record<string, string>): string {
  if (!query) {
    return path;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    params.set(key, value);
  }

  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export function normalizeOauthProvider(provider?: string): SupportedOauthProvider {
  switch ((provider ?? '').trim().toLowerCase()) {
    case 'youtube':
      return 'youtube';
    case 'tiktok':
      return 'tiktok';
    case 'google':
    default:
      return 'google';
  }
}

export function getOauthProviderLabel(provider?: string): string {
  const normalized = normalizeOauthProvider(provider);

  switch (normalized) {
    case 'youtube':
      return 'YouTube';
    case 'tiktok':
      return 'TikTok';
    case 'google':
    default:
      return 'Google';
  }
}

function getOauthStartPath(provider: SupportedOauthProvider): string {
  return `/api/accounts/oauth/${provider}/start`;
}

function getOauthCallbackPath(provider: SupportedOauthProvider): string {
  return `/api/accounts/oauth/${provider}/callback`;
}

async function request(
  fetcher: AuthFetch,
  method: string,
  url: string,
): Promise<{ status: number; body: AccountsResponseBody }> {
  const response = await fetcher(url, {
    method,
    credentials: 'include',
  });

  return {
    status: response.status,
    body: (await response.json()) as AccountsResponseBody,
  };
}

export async function startAccountsOauth(
  provider: SupportedOauthProvider,
  fetcher: AuthFetch = globalThis.fetch as AuthFetch,
): Promise<{ ok: true; redirectUrl: string } | { ok: false; status: number; error: string }> {
  const response = await request(fetcher, 'GET', getOauthStartPath(provider));

  if (response.status !== 200 || !response.body.redirectUrl) {
    return {
      ok: false,
      status: response.status,
      error: response.body.error ?? `Unable to start ${getOauthProviderLabel(provider)} OAuth.`,
    };
  }

  return {
    ok: true,
    redirectUrl: response.body.redirectUrl,
  };
}

export async function completeAccountsOauthCallback(
  options: {
    provider?: string;
    code: string;
    state: string;
    fetcher?: AuthFetch;
  },
): Promise<{ ok: true; result: AccountOauthCallbackResult; provider: SupportedOauthProvider } | { ok: false; status: number; error: string; provider: SupportedOauthProvider }> {
  const provider = normalizeOauthProvider(options.provider);
  const response = await request(
    options.fetcher ?? globalThis.fetch as AuthFetch,
    'GET',
    buildUrl(getOauthCallbackPath(provider), {
      code: options.code,
      state: options.state,
    }),
  );

  if (response.status !== 200 || !response.body.account) {
    return {
      ok: false,
      status: response.status,
      error: response.body.error ?? `Unable to complete ${getOauthProviderLabel(provider)} OAuth.`,
      provider,
    };
  }

  return {
    ok: true,
    provider,
    result: {
      account: response.body.account,
      sync: response.body.sync,
    },
  };
}
