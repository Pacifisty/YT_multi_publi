import {
  completeGoogleLoginCallback,
  type AuthFetch,
} from '../../../../lib/auth-client';

export interface LoginCallbackPageView {
  route: '/login/callback';
  status: 'processing';
  heading: string;
  body: string;
}

export interface LoginCallbackLoadResult {
  page?: LoginCallbackPageView;
  redirectTo?: '/onboarding/plan' | '/workspace/dashboard';
  errorState?: {
    heading: string;
    body: string;
    cta: string;
    ctaHref: '/login';
  };
}

export function buildLoginCallbackPageView(): LoginCallbackPageView {
  return {
    route: '/login/callback',
    status: 'processing',
    heading: 'Completing Google sign-in',
    body: 'Checking the Google authorization response and restoring your session.',
  };
}

export async function completeLoginCallback(options: {
  code?: string;
  state?: string;
  fetcher?: AuthFetch;
}): Promise<LoginCallbackLoadResult> {
  if (!options.code || !options.state) {
    return {
      errorState: {
        heading: 'Google sign-in could not be completed',
        body: 'The callback is missing the authorization code or state value.',
        cta: 'Back to login',
        ctaHref: '/login',
      },
    };
  }

  const result = await completeGoogleLoginCallback(
    {
      code: options.code,
      state: options.state,
    },
    options.fetcher,
  );

  if (!result.ok) {
    return {
      errorState: {
        heading: 'Google sign-in failed',
        body: result.error,
        cta: 'Back to login',
        ctaHref: '/login',
      },
    };
  }

  return {
    redirectTo: result.user.needsPlanSelection ? '/onboarding/plan' : '/workspace/dashboard',
  };
}
