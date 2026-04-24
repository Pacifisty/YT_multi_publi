import { getAuthenticatedUser, UnauthorizedError, type AuthFetch } from '../lib/auth-client';

export interface RootPageView {
  route: '/';
  redirectTo: '/login' | '/onboarding/plan' | '/workspace/dashboard';
}

export async function buildRootPageView(options: { fetcher?: AuthFetch } = {}): Promise<RootPageView> {
  try {
    const user = await getAuthenticatedUser(options.fetcher);

    return {
      route: '/',
      redirectTo: user.needsPlanSelection ? '/onboarding/plan' : '/workspace/dashboard',
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return {
        route: '/',
        redirectTo: '/login',
      };
    }

    throw error;
  }
}

export const resolveRootPage = buildRootPageView;
