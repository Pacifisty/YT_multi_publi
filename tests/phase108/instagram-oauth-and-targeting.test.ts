import { describe, it, expect, vi } from 'vitest';
import { createCampaignsModule } from '../../apps/api/src/campaigns/campaigns.module';
import { AccountsService } from '../../apps/api/src/accounts/accounts.service';
import { TokenCryptoService } from '../../apps/api/src/common/crypto/token-crypto.service';
import { createApiRouter, type ApiRequest } from '../../apps/api/src/router';
import {
  InstagramOauthService,
  type InstagramOauthSession,
} from '../../apps/api/src/integrations/instagram/instagram-oauth.service';
import {
  CampaignService,
  InMemoryCampaignRepository,
  type AccountServiceProvider,
  type ConnectedAccountRecord,
  type CreateInstagramTargetInput,
} from '../../apps/api/src/campaigns/campaign.service';

describe('Phase 108 - Instagram OAuth and campaign targeting foundation', () => {
  it('creates Instagram authorization redirects and exchanges codes through Meta Graph OAuth', async () => {
    const env = {
      INSTAGRAM_CLIENT_ID: 'ig-client',
      INSTAGRAM_CLIENT_SECRET: 'ig-secret',
      INSTAGRAM_REDIRECT_URI: 'https://app.example.com/workspace/accounts/callback?provider=instagram',
    };
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      const href = String(url);

      if (href.endsWith('/oauth/access_token') && init?.method === 'POST') {
        expect(String(init.body)).toContain('client_id=ig-client');
        expect(String(init.body)).toContain('code=auth-code');
        expect(String(init.body)).toContain('code_verifier=');
        return jsonResponse({
          access_token: 'ig-access-token',
          expires_in: 3600,
          scope: 'instagram_business_basic,instagram_business_content_publish',
        });
      }

      if (href.includes('/me?fields=id,name')) {
        expect(href).toContain('access_token=ig-access-token');
        return jsonResponse({
          id: 'ig-user-123',
          name: 'Studio Reels',
        });
      }

      throw new Error(`Unexpected request: ${href}`);
    }) as unknown as typeof fetch;

    const service = new InstagramOauthService({ env, fetchImpl, graphApiVersion: 'v19.0' });
    const session: InstagramOauthSession = {};
    const redirectUrl = await service.createAuthorizationRedirect(session);
    const parsed = new URL(redirectUrl);

    expect(parsed.hostname).toBe('www.facebook.com');
    expect(parsed.searchParams.get('client_id')).toBe('ig-client');
    expect(parsed.searchParams.get('scope')).toContain('instagram_business_content_publish');
    expect(session.oauthStateNonce).toBeTruthy();
    expect(session.instagramCodeVerifier).toBeTruthy();
    expect(service.validateCallbackState(session, session.oauthStateNonce!)).toBe(true);
    expect(service.validateCallbackState(session, 'wrong-state')).toBe(false);

    const tokenResult = await service.exchangeCodeForTokens('auth-code', session.instagramCodeVerifier);

    expect(tokenResult.accessToken).toBe('ig-access-token');
    expect(tokenResult.refreshToken).toBe('ig-access-token');
    expect(tokenResult.profile.providerSubject).toBe('ig-user-123');
    expect(tokenResult.profile.displayName).toBe('Studio Reels');
    expect(tokenResult.scopes).toContain('instagram_business_basic');
  });

  it('persists Instagram connected accounts through the shared account OAuth flow', async () => {
    const tokenCryptoService = {
      encrypt: vi.fn((token: string) => `enc:${token}`),
      decrypt: vi.fn((token: string) => token.replace(/^enc:/, '')),
    } as unknown as TokenCryptoService;
    const instagramOauthService = {
      createAuthorizationRedirect: vi.fn(async (session: InstagramOauthSession | null | undefined) => {
        if (session) {
          session.oauthStateNonce = 'ig-state';
          session.instagramCodeVerifier = 'ig-verifier';
        }
        return 'https://www.facebook.com/v19.0/dialog/oauth?state=ig-state';
      }),
      validateCallbackState: vi.fn((session: InstagramOauthSession | null | undefined, state: string) => {
        return session?.oauthStateNonce === state;
      }),
      exchangeCodeForTokens: vi.fn(async () => ({
        accessToken: 'ig-access',
        refreshToken: 'ig-refresh',
        scopes: ['instagram_business_basic', 'instagram_business_content_publish'],
        tokenExpiresAt: '2026-04-28T12:00:00.000Z',
        profile: {
          providerSubject: 'ig-user-1',
          displayName: 'Reels Lab',
        },
      })),
      refreshAccessToken: vi.fn(),
    } as unknown as InstagramOauthService & {
      createAuthorizationRedirect: ReturnType<typeof vi.fn>;
      validateCallbackState: ReturnType<typeof vi.fn>;
      exchangeCodeForTokens: ReturnType<typeof vi.fn>;
    };

    const service = new AccountsService({
      tokenCryptoService,
      instagramOauthService,
    });
    const session: InstagramOauthSession & { adminUser?: { email?: string } } = {
      adminUser: { email: 'OWNER@Example.com' },
    };

    await service.createAuthorizationRedirectForProvider('instagram', session);
    const result = await service.handleOauthCallbackForProvider('instagram', {
      code: 'ig-code',
      state: 'ig-state',
      session,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.account.provider).toBe('instagram');
    expect(result.account.ownerEmail).toBe('owner@example.com');
    expect(result.account.displayName).toBe('Reels Lab');
    expect(result.account.accessTokenEnc).toBe('enc:ig-access');
    expect(result.account.refreshTokenEnc).toBe('enc:ig-refresh');
    expect(session.oauthStateNonce).toBeUndefined();
    expect(session.instagramCodeVerifier).toBeUndefined();
    expect(instagramOauthService.exchangeCodeForTokens).toHaveBeenCalledWith('ig-code', 'ig-verifier');
  });

  it('creates Instagram campaign targets with account ownership checks', async () => {
    const instagramAccount: ConnectedAccountRecord = {
      id: 'ig-account-1',
      provider: 'instagram',
      displayName: '@studio',
      ownerEmail: 'user@example.com',
      status: 'connected',
    };
    const youtubeAccount: ConnectedAccountRecord = {
      id: 'yt-account-1',
      provider: 'youtube',
      displayName: 'Main Channel',
      ownerEmail: 'user@example.com',
      status: 'connected',
    };
    const accountService: AccountServiceProvider = {
      getConnectedAccount: vi.fn(async (id: string) => {
        if (id === instagramAccount.id) return instagramAccount;
        if (id === youtubeAccount.id) return youtubeAccount;
        return null;
      }),
      listConnectedAccounts: vi.fn(async (ownerEmail: string, provider: string) => {
        return ownerEmail === 'user@example.com' && provider === 'instagram'
          ? [instagramAccount]
          : [];
      }),
    };
    const service = new CampaignService({
      repository: new InMemoryCampaignRepository(),
      accountService,
      now: () => new Date('2026-04-28T09:00:00.000Z'),
    });
    const { campaign } = await service.createCampaign({
      ownerEmail: 'user@example.com',
      title: 'Instagram launch',
      videoAssetId: 'video-1',
    });

    const input: CreateInstagramTargetInput = {
      connectedAccountId: instagramAccount.id,
      caption: 'New reel caption',
      shareToFeed: false,
    };
    const { target } = await service.createInstagramTarget(campaign.id, input, 'user@example.com');

    expect(target.platform).toBe('instagram');
    expect(target.connectedAccountId).toBe(instagramAccount.id);
    expect(target.destinationLabel).toBe('@studio');
    expect(target.instagramCaption).toBe('New reel caption');
    expect(target.instagramShareToFeed).toBe(false);
    expect(target.videoDescription).toBe('New reel caption');

    const accounts = await service.listConnectedInstagramAccounts('user@example.com');
    expect(accounts).toEqual([instagramAccount]);
    const targets = await service.getInstagramTargetsForCampaign(campaign.id, 'user@example.com');
    expect(targets).toHaveLength(1);

    await expect(
      service.createInstagramTarget(campaign.id, input, 'user@example.com'),
    ).rejects.toThrow('Target for this Instagram account already exists in the campaign');

    await expect(
      service.createInstagramTarget(
        campaign.id,
        { connectedAccountId: youtubeAccount.id, caption: 'Wrong provider' },
        'user@example.com',
      ),
    ).rejects.toThrow('Account is not an Instagram account');
  });

  it('accepts Instagram targets through the campaign target API', async () => {
    const campaignsModule = createCampaignsModule();
    const router = createApiRouter({ campaignsModule });
    const session = { adminUser: { id: 'admin-1', email: 'user@example.com' } };
    const { campaign } = await campaignsModule.campaignService.createCampaign({
      ownerEmail: 'user@example.com',
      title: 'Instagram API target',
      videoAssetId: 'video-ig-api',
    });

    const request: ApiRequest = {
      method: 'POST',
      path: `/api/campaigns/${campaign.id}/targets/bulk`,
      session,
      body: {
        targets: [
          {
            platform: 'instagram',
            destinationId: 'ig-account-1',
            destinationLabel: '@studio',
            connectedAccountId: 'ig-account-1',
            videoTitle: 'Instagram launch',
            videoDescription: 'Generic description',
            instagramCaption: 'Custom Reels caption',
            instagramShareToFeed: false,
            privacy: 'public',
          },
        ],
      },
    };

    const response = await router.handle(request);

    expect(response.status).toBe(201);
    expect(response.body.targets[0]).toMatchObject({
      platform: 'instagram',
      connectedAccountId: 'ig-account-1',
      instagramCaption: 'Custom Reels caption',
      instagramShareToFeed: false,
      privacy: 'public',
    });
  });
});

function jsonResponse(payload: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
