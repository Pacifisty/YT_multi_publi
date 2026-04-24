import {
  completeAccountsOauthCallback,
  getOauthProviderLabel,
  normalizeOauthProvider,
  type SupportedOauthProvider,
} from '../../../../../lib/accounts-client';
import type { AuthFetch } from '../../../../../lib/auth-client';

export interface AccountsOauthCallbackPageView {
  route: '/workspace/accounts/callback';
  provider: SupportedOauthProvider;
  providerLabel: string;
  heading: string;
  body: string;
}

export interface AccountsOauthCallbackLoadResult {
  page?: AccountsOauthCallbackPageView;
  redirectTo?: string;
  errorState?: {
    heading: string;
    body: string;
    cta: string;
    ctaHref: '/workspace/accounts';
  };
}

function buildWorkspaceAccountsHref(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === '') {
      continue;
    }

    params.set(key, String(value));
  }

  const search = params.toString();
  return search ? `/workspace/accounts?${search}` : '/workspace/accounts';
}

export function buildAccountsOauthCallbackPageView(provider?: string): AccountsOauthCallbackPageView {
  const normalizedProvider = normalizeOauthProvider(provider);
  const providerLabel = getOauthProviderLabel(normalizedProvider);

  return {
    route: '/workspace/accounts/callback',
    provider: normalizedProvider,
    providerLabel,
    heading: `Finishing ${providerLabel} connection`,
    body: `Connecting your ${providerLabel} account and syncing the first results.`,
  };
}

export async function completeAccountsOauthCallbackPage(options: {
  code?: string;
  state?: string;
  provider?: string;
  fetcher?: AuthFetch;
}): Promise<AccountsOauthCallbackLoadResult> {
  const provider = normalizeOauthProvider(options.provider);
  const providerLabel = getOauthProviderLabel(provider);

  if (!options.code || !options.state) {
    return {
      errorState: {
        heading: `${providerLabel} callback is incomplete`,
        body: 'The callback is missing the OAuth code or state parameter.',
        cta: 'Back to accounts',
        ctaHref: '/workspace/accounts',
      },
    };
  }

  const result = await completeAccountsOauthCallback({
    provider,
    code: options.code,
    state: options.state,
    fetcher: options.fetcher,
  });

  if (!result.ok) {
    if (result.status === 401) {
      return {
        redirectTo: '/login',
      };
    }

    return {
      redirectTo: buildWorkspaceAccountsHref({
        oauth: 'error',
        provider,
        oauthMessage: result.error,
      }),
    };
  }

  return {
    redirectTo: buildWorkspaceAccountsHref({
      oauth: 'success',
      provider,
      syncChannels: result.result.sync?.channelCount,
      syncMessage: result.result.sync?.message,
    }),
  };
}
