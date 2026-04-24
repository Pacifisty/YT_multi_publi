import {
  getAuthenticatedUser,
  UnauthorizedError,
  type AuthFetch,
  type AuthenticatedUser,
} from '../../../../lib/auth-client';
import {
  getAccountPlanSummary,
  selectAccountPlan,
  type AccountPlanSummary,
  type AccountPlanType,
} from '../../../../lib/account-plan-client';

export interface AccountPlanOptionView {
  id: AccountPlanType;
  label: string;
  priceLabel: string;
  description: string;
  tokenSummary: string;
  visitSummary: string;
  platformSummary: string;
  featured?: boolean;
  selected: boolean;
}

export interface PlanOnboardingPageView {
  route: '/onboarding/plan';
  title: string;
  description: string;
  currentUser: {
    email: string;
    fullName?: string;
  };
  selectedPlan: AccountPlanType;
  options: AccountPlanOptionView[];
  account: AccountPlanSummary;
}

export interface PlanOnboardingLoadResult {
  page?: PlanOnboardingPageView;
  redirectTo?: '/login' | '/workspace/dashboard';
  errorState?: {
    heading: string;
    body: string;
    cta: string;
    ctaHref: '/login';
  };
}

export const ACCOUNT_PLAN_OPTIONS: Omit<AccountPlanOptionView, 'selected'>[] = [
  {
    id: 'FREE',
    label: 'Free',
    priceLabel: 'Gratis',
    description: 'Ideal para conhecer a plataforma e publicar no YouTube sem custo mensal.',
    tokenSummary: 'ganho de 150 tokens todo mes na escolha deste plano',
    visitSummary: '+15 tokens por visita diaria',
    platformSummary: 'YouTube',
  },
  {
    id: 'BASIC',
    label: 'Basic',
    priceLabel: 'R$ 9,99 / mes',
    description: 'Mais folego para operacao recorrente com limite maior de campanhas.',
    tokenSummary: 'ganho de 400 tokens todo mes na escolha deste plano',
    visitSummary: '+40 tokens por visita diaria',
    platformSummary: 'YouTube',
  },
  {
    id: 'PRO',
    label: 'Pro',
    priceLabel: 'R$ 19,99 / mes',
    description: 'Plano completo para publicar em YouTube e TikTok.',
    tokenSummary: 'ganho de 800 tokens todo mes na escolha deste plano',
    visitSummary: '+80 tokens por visita diaria',
    platformSummary: 'YouTube + TikTok',
    featured: true,
  },
];

function buildPlanOptions(selectedPlan: AccountPlanType): AccountPlanOptionView[] {
  return ACCOUNT_PLAN_OPTIONS.map((option) => ({
    ...option,
    selected: option.id === selectedPlan,
  }));
}

function normalizeUser(user: AuthenticatedUser): PlanOnboardingPageView['currentUser'] {
  return {
    email: user.email,
    fullName: user.fullName,
  };
}

export async function buildPlanOnboardingPage(options: {
  fetcher?: AuthFetch;
} = {}): Promise<PlanOnboardingLoadResult> {
  let user: AuthenticatedUser;

  try {
    user = await getAuthenticatedUser(options.fetcher);
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return {
        redirectTo: '/login',
      };
    }

    throw error;
  }

  if (!user.needsPlanSelection) {
    return {
      redirectTo: '/workspace/dashboard',
    };
  }

  const accountResult = await getAccountPlanSummary(options.fetcher);
  if (!accountResult.ok) {
    return {
      errorState: {
        heading: 'Plan selection is unavailable',
        body: accountResult.error,
        cta: 'Back to login',
        ctaHref: '/login',
      },
    };
  }

  return {
    page: {
      route: '/onboarding/plan',
      title: 'Choose your account plan',
      description: 'Your account has already been created. Pick the plan you want to use before entering the workspace.',
      currentUser: normalizeUser(user),
      selectedPlan: accountResult.account.plan,
      options: buildPlanOptions(accountResult.account.plan),
      account: accountResult.account,
    },
  };
}

export async function submitPlanSelection(options: {
  plan: AccountPlanType;
  fetcher?: AuthFetch;
}): Promise<{ ok: true; account: AccountPlanSummary; user?: AuthenticatedUser; redirectTo: '/workspace/dashboard' } | { ok: false; status: number; error: string }> {
  const result = await selectAccountPlan(options.plan, options.fetcher);

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    account: result.result.account,
    user: result.result.user,
    redirectTo: '/workspace/dashboard',
  };
}
