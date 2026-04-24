import {
  claimDailyVisitTokens,
  claimMonthlyGrantTokens,
  getAccountPlanSummary,
  selectAccountPlan,
  type AccountPlanSummary,
  type AccountPlanType,
} from '../../../../lib/account-plan-client';
import {
  getAuthenticatedUser,
  UnauthorizedError,
  type AuthFetch,
} from '../../../../lib/auth-client';
import { ACCOUNT_PLAN_OPTIONS, type AccountPlanOptionView } from '../../../(public)/onboarding/plan/page';

export interface WorkspacePlanOptionView extends AccountPlanOptionView {
  current: boolean;
  canChange: boolean;
}

export interface WorkspacePlansPageView {
  route: '/workspace/planos';
  title: string;
  subtitle: string;
  account: AccountPlanSummary;
  options: WorkspacePlanOptionView[];
  rules: string[];
}

export interface WorkspacePlansLoadResult {
  page?: WorkspacePlansPageView;
  redirectTo?: '/login' | '/onboarding/plan';
  errorState?: {
    heading: string;
    body: string;
    cta: string;
    ctaHref: '/workspace/dashboard';
  };
}

function buildPlanOptions(account: AccountPlanSummary): WorkspacePlanOptionView[] {
  return ACCOUNT_PLAN_OPTIONS.map((option) => ({
    ...option,
    selected: option.id === account.plan,
    current: option.id === account.plan,
    canChange: option.id !== account.plan,
  }));
}

function buildRules(): string[] {
  return [
    'Cada conta conectada para publicar custa 5 tokens por campanha.',
    'A publicacao so acontece se voce tiver tokens suficientes para todas as contas selecionadas.',
    'Se nao houver tokens suficientes, a campanha nao sera publicada e voce vera um aviso de out of Tokens.',
    'O limite de tokens nunca e ultrapassado; o bonus diario respeita o maximo do plano.',
    'TikTok esta disponivel somente no plano PRO.',
  ];
}

export async function buildWorkspacePlansPage(options: {
  fetcher?: AuthFetch;
  autoClaimMonthlyGrant?: boolean;
} = {}): Promise<WorkspacePlansLoadResult> {
  try {
    const user = await getAuthenticatedUser(options.fetcher);

    if (user.needsPlanSelection) {
      return {
        redirectTo: '/onboarding/plan',
      };
    }
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return {
        redirectTo: '/login',
      };
    }

    throw error;
  }

  const summaryResult = await getAccountPlanSummary(options.fetcher);
  if (!summaryResult.ok) {
    return {
      errorState: {
        heading: 'Plans are unavailable',
        body: summaryResult.error,
        cta: 'Back to dashboard',
        ctaHref: '/workspace/dashboard',
      },
    };
  }

  let account = summaryResult.account;
  if (options.autoClaimMonthlyGrant && !account.monthlyGrantClaimedThisMonth) {
    const grantResult = await claimMonthlyGrantTokens(options.fetcher);
    if (grantResult.ok) {
      account = grantResult.account;
    }
  }

  return {
    page: {
      route: '/workspace/planos',
      title: 'Planos',
      subtitle: `Plano do usuario: ${account.planLabel} | Saldo: ${account.tokens} tokens`,
      account,
      options: buildPlanOptions(account),
      rules: buildRules(),
    },
  };
}

export async function submitWorkspacePlanChange(options: {
  plan: AccountPlanType;
  fetcher?: AuthFetch;
}): Promise<{ ok: true; account: AccountPlanSummary } | { ok: false; status: number; error: string }> {
  const result = await selectAccountPlan(options.plan, options.fetcher);

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    account: result.result.account,
  };
}

export async function claimWorkspaceDailyVisitBonus(options: {
  fetcher?: AuthFetch;
} = {}): Promise<{ ok: true; account: AccountPlanSummary; claimed: boolean; grantedTokens: number } | { ok: false; status: number; error: string }> {
  const result = await claimDailyVisitTokens(options.fetcher);

  if (!result.ok) {
    return result;
  }

  return result;
}

export async function claimWorkspaceMonthlyGrant(options: {
  fetcher?: AuthFetch;
} = {}): Promise<{ ok: true; account: AccountPlanSummary; claimed: boolean; grantedTokens: number } | { ok: false; status: number; error: string }> {
  const result = await claimMonthlyGrantTokens(options.fetcher);

  if (!result.ok) {
    return result;
  }

  return result;
}
