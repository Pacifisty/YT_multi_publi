import { describe, expect, test, vi } from 'vitest';

import { buildAppLayout } from '../../apps/web/app/layout-view';
import { buildRootPageView } from '../../apps/web/app/page';
import { completeLoginCallback } from '../../apps/web/app/(public)/login/callback/page';
import { buildPlanOnboardingPage } from '../../apps/web/app/(public)/onboarding/plan/page';
import { buildWorkspaceHomePageView } from '../../apps/web/app/(admin)/workspace/page';
import { completeAccountsOauthCallbackPage } from '../../apps/web/app/(admin)/workspace/accounts/callback/page';
import { buildWorkspacePlansPage } from '../../apps/web/app/(admin)/workspace/planos/page';

describe('web route entrypoints', () => {
  test('app layout exposes the shared frontend document assets', () => {
    expect(buildAppLayout()).toEqual({
      lang: 'en',
      title: 'YT Multi Publi',
      rootId: 'app',
      assets: {
        stylesheet: '/app.css',
        script: '/app.js',
      },
      fonts: ['Inter', 'JetBrains Mono'],
    });
  });

  test('root and workspace entry routes redirect according to the authenticated session state', async () => {
    const anonymousFetcher = vi.fn().mockResolvedValue({
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });

    await expect(buildRootPageView({ fetcher: anonymousFetcher })).resolves.toEqual({
      route: '/',
      redirectTo: '/login',
    });
    await expect(buildWorkspaceHomePageView({ fetcher: anonymousFetcher })).resolves.toEqual({
      route: '/workspace',
      redirectTo: '/login',
    });

    const pendingPlanFetcher = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        user: {
          email: 'creator@example.com',
          fullName: 'Creator',
          needsPlanSelection: true,
        },
      }),
    });

    await expect(buildRootPageView({ fetcher: pendingPlanFetcher })).resolves.toEqual({
      route: '/',
      redirectTo: '/onboarding/plan',
    });
    await expect(buildWorkspaceHomePageView({ fetcher: pendingPlanFetcher })).resolves.toEqual({
      route: '/workspace',
      redirectTo: '/onboarding/plan',
    });
  });

  test('login callback route validates missing params and redirects successful sessions', async () => {
    expect(await completeLoginCallback({})).toEqual({
      errorState: {
        heading: 'Google sign-in could not be completed',
        body: 'The callback is missing the authorization code or state value.',
        cta: 'Back to login',
        ctaHref: '/login',
      },
    });

    const fetcher = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        user: {
          email: 'creator@example.com',
          needsPlanSelection: false,
        },
      }),
    });

    await expect(completeLoginCallback({
      code: 'oauth-code',
      state: 'nonce',
      fetcher,
    })).resolves.toEqual({
      redirectTo: '/workspace/dashboard',
    });
  });

  test('plan onboarding route loads the signed-in user and current plan', async () => {
    const fetcher = vi.fn(async (input: string) => {
      if (input === '/auth/me') {
        return {
          status: 200,
          json: async () => ({
            user: {
              email: 'creator@example.com',
              fullName: 'Creator',
              needsPlanSelection: true,
            },
          }),
        };
      }

      if (input === '/api/account/plan') {
        return {
          status: 200,
          json: async () => ({
            account: {
              email: 'creator@example.com',
              plan: 'FREE',
              planLabel: 'Free',
              tokens: 0,
              maxTokens: 150,
              dailyVisitTokens: 15,
              campaignPublishCostTokens: 5,
              priceBrl: null,
              durationDays: null,
              billingStartedAt: null,
              billingExpiresAt: null,
              expiresSoon: false,
              dailyVisitClaimedToday: false,
              monthlyGrantClaimedThisMonth: false,
              allowedPlatforms: ['youtube'],
              depthProfile: 'light',
            },
          }),
        };
      }

      throw new Error(`Unexpected fetch URL: ${input}`);
    });

    const result = await buildPlanOnboardingPage({ fetcher });

    expect(result.page?.route).toBe('/onboarding/plan');
    expect(result.page?.currentUser).toEqual({
      email: 'creator@example.com',
      fullName: 'Creator',
    });
    expect(result.page?.selectedPlan).toBe('FREE');
    expect(result.page?.options.map((option) => option.id)).toEqual(['FREE', 'BASIC', 'PRO']);
    expect(result.page?.options.find((option) => option.id === 'FREE')?.selected).toBe(true);
  });

  test('accounts callback route returns workspace redirects for success and error states', async () => {
    const successFetcher = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        account: {
          id: 'acct-1',
          provider: 'youtube',
          email: 'ops@example.com',
        },
        sync: {
          channelCount: 2,
          message: 'Found 2 YouTube channels for this Google account.',
        },
      }),
    });

    await expect(completeAccountsOauthCallbackPage({
      provider: 'youtube',
      code: 'oauth-code',
      state: 'oauth-state',
      fetcher: successFetcher,
    })).resolves.toEqual({
      redirectTo: '/workspace/accounts?oauth=success&provider=youtube&syncChannels=2&syncMessage=Found+2+YouTube+channels+for+this+Google+account.',
    });

    const errorFetcher = vi.fn().mockResolvedValue({
      status: 400,
      json: async () => ({
        error: 'OAuth state validation failed. Please reconnect and try again.',
      }),
    });

    await expect(completeAccountsOauthCallbackPage({
      provider: 'tiktok',
      code: 'oauth-code',
      state: 'oauth-state',
      fetcher: errorFetcher,
    })).resolves.toEqual({
      redirectTo: '/workspace/accounts?oauth=error&provider=tiktok&oauthMessage=OAuth+state+validation+failed.+Please+reconnect+and+try+again.',
    });
  });

  test('workspace plans route returns the current account plan and upgrade rules', async () => {
    const fetcher = vi.fn(async (input: string) => {
      if (input === '/auth/me') {
        return {
          status: 200,
          json: async () => ({
            user: {
              email: 'creator@example.com',
              fullName: 'Creator',
              needsPlanSelection: false,
            },
          }),
        };
      }

      if (input === '/api/account/plan') {
        return {
          status: 200,
          json: async () => ({
            account: {
              email: 'creator@example.com',
              plan: 'PRO',
              planLabel: 'Pro',
              tokens: 80,
              maxTokens: 800,
              dailyVisitTokens: 80,
              campaignPublishCostTokens: 5,
              priceBrl: 19.99,
              durationDays: 30,
              billingStartedAt: '2026-04-01T00:00:00.000Z',
              billingExpiresAt: '2026-05-01T00:00:00.000Z',
              expiresSoon: false,
              dailyVisitClaimedToday: true,
              monthlyGrantClaimedThisMonth: true,
              allowedPlatforms: ['youtube', 'tiktok', 'instagram'],
              depthProfile: 'deep',
            },
          }),
        };
      }

      throw new Error(`Unexpected fetch URL: ${input}`);
    });

    const result = await buildWorkspacePlansPage({ fetcher });

    expect(result.page?.route).toBe('/workspace/planos');
    expect(result.page?.account.plan).toBe('PRO');
    expect(result.page?.options).toHaveLength(3);
    expect(result.page?.options.find((option) => option.id === 'PRO')).toMatchObject({
      selected: true,
      current: true,
      canChange: false,
    });
    expect(result.page?.rules).toContain('TikTok e Instagram estao disponiveis somente nos planos PRO e Premium.');
  });
});
