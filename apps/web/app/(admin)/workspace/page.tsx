import { getAuthenticatedUser, UnauthorizedError, type AuthFetch } from '../../../lib/auth-client';

export interface WorkspaceHomePageView {
  route: '/workspace';
  redirectTo: '/login' | '/onboarding/plan' | '/workspace/dashboard';
}

export async function buildWorkspaceHomePageView(options: {
  fetcher?: AuthFetch;
} = {}): Promise<WorkspaceHomePageView> {
  try {
    const user = await getAuthenticatedUser(options.fetcher);

    return {
      route: '/workspace',
      redirectTo: user.needsPlanSelection ? '/onboarding/plan' : '/workspace/dashboard',
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return {
        route: '/workspace',
        redirectTo: '/login',
      };
    }

    throw error;
  }
}

export const resolveWorkspaceHomePage = buildWorkspaceHomePageView;
