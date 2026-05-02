import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createApiRouter } from '../../apps/api/src/router';
import { createCampaignsModule } from '../../apps/api/src/campaigns/campaigns.module';
import { AccountsController } from '../../apps/api/src/accounts/accounts.controller';
import { AccountsService } from '../../apps/api/src/accounts/accounts.service';
import { MediaController } from '../../apps/api/src/media/media.controller';
import { MediaService, InMemoryMediaRepository } from '../../apps/api/src/media/media.service';
import { SessionGuard } from '../../apps/api/src/auth/session.guard';
import { TokenCryptoService } from '../../apps/api/src/common/crypto/token-crypto.service';
import type { ConnectedAccountRecord } from '../../apps/api/src/accounts/accounts.service';
import { AccountPlanController } from '../../apps/api/src/account-plan/account-plan.controller';
import { AccountPlanService } from '../../apps/api/src/account-plan/account-plan.service';

const TEST_KEY = '12345678901234567890123456789012';
const authedSession = { adminUser: { email: 'admin@test.com' } };

function createAccount(crypto: TokenCryptoService): ConnectedAccountRecord {
  return {
    id: 'acct-1',
    provider: 'google',
    googleSubject: 'sub-1',
    email: 'user@gmail.com',
    displayName: 'User',
    accessTokenEnc: crypto.encrypt('tok'),
    refreshTokenEnc: null,
    scopes: [],
    tokenExpiresAt: null,
    status: 'connected',
    connectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('API Router — accounts routes', () => {
  let router: ReturnType<typeof createApiRouter>;
  let crypto: TokenCryptoService;

  beforeEach(() => {
    crypto = new TokenCryptoService({ OAUTH_TOKEN_KEY: TEST_KEY });
    const account = createAccount(crypto);
    const accountsService = new AccountsService({
      tokenCryptoService: crypto,
      listConnectedAccounts: async () => [account],
      getConnectedAccount: async (id: string) => (id === account.id ? account : null),
      deleteConnectedAccount: async (id: string) => id === account.id,
      youtubeChannelsService: {
        listMineChannels: async () => ({
          channels: [
            {
              channelId: 'UC_demo',
              title: 'Demo Channel',
              handle: '@demo',
              thumbnailUrl: 'https://example.com/thumb.jpg',
            },
          ],
        }),
      },
      createAuthorizationRedirect: async () => 'https://accounts.google.com/o/oauth2/v2/auth?state=state-123',
      handleOauthCallback: async (input) => (input.state === 'ok-state'
        ? { ok: true, account }
        : { ok: false, reason: 'INVALID_STATE' }),
      tikTokOauthService: {
        createAuthorizationRedirect: async () => 'https://www.tiktok.com/v2/auth/authorize/?state=state-123',
        validateCallbackState: () => true,
        exchangeCodeForTokens: async () => ({
          accessToken: 'tt-token',
          scopes: ['user.info.basic'],
          tokenExpiresAt: null,
          profile: { providerSubject: 'tt-user-1', displayName: 'TikTok User' },
        }),
      } as any,
    });
    const accountsController = new AccountsController(accountsService, new SessionGuard());

    router = createApiRouter({
      campaignsModule: createCampaignsModule(),
      accountsController,
    });
  });

  it('GET /api/accounts returns account list', async () => {
    const res = await router.handle({
      method: 'GET',
      path: '/api/accounts',
      session: authedSession,
    });
    expect(res.status).toBe(200);
    expect(res.body.accounts).toHaveLength(1);
  });

  it('GET /api/accounts/:accountId returns single account', async () => {
    const res = await router.handle({
      method: 'GET',
      path: '/api/accounts/acct-1',
      session: authedSession,
    });
    expect(res.status).toBe(200);
    expect(res.body.account.id).toBe('acct-1');
  });

  it('GET /api/accounts/:accountId returns 404 for unknown', async () => {
    const res = await router.handle({
      method: 'GET',
      path: '/api/accounts/unknown',
      session: authedSession,
    });
    expect(res.status).toBe(404);
  });

  it('GET /api/accounts/:accountId/channels returns channels', async () => {
    const res = await router.handle({
      method: 'GET',
      path: '/api/accounts/acct-1/channels',
      session: authedSession,
    });
    expect(res.status).toBe(200);
    expect(res.body.channels).toBeDefined();
  });

  it('POST /api/accounts/:accountId/channels/sync syncs channels', async () => {
    const res = await router.handle({
      method: 'POST',
      path: '/api/accounts/acct-1/channels/sync',
      session: authedSession,
    });
    expect(res.status).toBe(200);
    expect(res.body.channels).toBeDefined();
    expect(res.body.sync.channelCount).toBe(1);
  });

  it('GET /api/accounts/oauth/google/start returns redirect URL', async () => {
    const res = await router.handle({
      method: 'GET',
      path: '/api/accounts/oauth/google/start',
      session: authedSession,
    });
    expect(res.status).toBe(200);
    expect(res.body.redirectUrl).toContain('accounts.google.com');
  });

  it('GET /api/accounts/oauth/youtube/start returns redirect URL', async () => {
    const res = await router.handle({
      method: 'GET',
      path: '/api/accounts/oauth/youtube/start',
      session: authedSession,
    });
    expect(res.status).toBe(200);
    expect(res.body.redirectUrl).toContain('accounts.google.com');
  });

  it('GET /api/accounts/oauth/tiktok/start returns redirect URL', async () => {
    const res = await router.handle({
      method: 'GET',
      path: '/api/accounts/oauth/tiktok/start',
      session: authedSession,
    });
    expect(res.status).toBe(200);
    expect(res.body.redirectUrl).toContain('tiktok.com');
  });

  it('GET /api/accounts/oauth/google/callback returns account on valid code/state', async () => {
    const res = await router.handle({
      method: 'GET',
      path: '/api/accounts/oauth/google/callback',
      session: authedSession,
      query: { code: 'abc', state: 'ok-state' },
    });
    expect(res.status).toBe(200);
    expect(res.body.account.id).toBe('acct-1');
  });

  it('GET /api/accounts/oauth/youtube/callback returns account on valid code/state', async () => {
    const res = await router.handle({
      method: 'GET',
      path: '/api/accounts/oauth/youtube/callback',
      session: authedSession,
      query: { code: 'abc', state: 'ok-state' },
    });
    expect(res.status).toBe(200);
    expect(res.body.account.id).toBe('acct-1');
  });

  it('GET /api/accounts/oauth/tiktok/callback returns account on valid code/state', async () => {
    const res = await router.handle({
      method: 'GET',
      path: '/api/accounts/oauth/tiktok/callback',
      session: authedSession,
      query: { code: 'abc', state: 'ok-state' },
    });
    expect(res.status).toBe(200);
    expect(res.body.account.id).toBe('acct-1');
  });

  it('DELETE /api/accounts/:accountId disconnects with confirmation', async () => {
    const res = await router.handle({
      method: 'DELETE',
      path: '/api/accounts/acct-1',
      session: authedSession,
      body: { confirm: 'DISCONNECT' },
    });
    expect(res.status).toBe(200);
    expect(res.body.disconnected).toBe(true);
  });

  it('DELETE /api/accounts/:accountId/permanent deletes with confirmation', async () => {
    await router.handle({
      method: 'POST',
      path: '/api/accounts/acct-1/channels/sync',
      session: authedSession,
    });

    const res = await router.handle({
      method: 'DELETE',
      path: '/api/accounts/acct-1/permanent',
      session: authedSession,
      body: { confirm: 'DELETE' },
    });
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);
    expect(res.body.removedChannels).toBe(1);
  });

  it('returns 401 for unauthenticated account request', async () => {
    const res = await router.handle({
      method: 'GET',
      path: '/api/accounts',
      session: null,
    });
    expect(res.status).toBe(401);
  });
});

describe('API Router — media routes', () => {
  let router: ReturnType<typeof createApiRouter>;
  let mediaService: MediaService;

  beforeEach(() => {
    const repo = new InMemoryMediaRepository();
    mediaService = new MediaService({ storageRoot: '/tmp/test' }, repo);
    const mediaController = new MediaController(mediaService, new SessionGuard());

    router = createApiRouter({
      campaignsModule: createCampaignsModule(),
      mediaController,
    });
  });

  it('GET /api/media returns asset list', async () => {
    const res = await router.handle({
      method: 'GET',
      path: '/api/media',
      session: authedSession,
    });
    expect(res.status).toBe(200);
    expect(res.body.assets).toBeDefined();
  });

  it('POST /api/media creates an asset from JSON payload', async () => {
    const videoBytes = Buffer.from('fake-video-bytes');
    const res = await router.handle({
      method: 'POST',
      path: '/api/media',
      session: authedSession,
      body: {
        video: {
          originalName: 'demo.mp4',
          mimeType: 'video/mp4',
          base64Data: videoBytes.toString('base64'),
          sizeBytes: videoBytes.byteLength,
        },
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.asset.original_name).toBe('demo.mp4');
    expect(res.body.asset.asset_type).toBe('video');
  });

  it('GET /api/media/:id returns 404 for unknown', async () => {
    const res = await router.handle({
      method: 'GET',
      path: '/api/media/unknown-id',
      session: authedSession,
    });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/media/:id returns 404 for unknown', async () => {
    const res = await router.handle({
      method: 'DELETE',
      path: '/api/media/unknown-id',
      session: authedSession,
    });
    expect(res.status).toBe(404);
  });

  it('POST /api/media/:id/link-thumbnail returns 400 without body', async () => {
    const res = await router.handle({
      method: 'POST',
      path: '/api/media/thumb-1/link-thumbnail',
      session: authedSession,
      body: {},
    });
    expect(res.status).toBe(400);
  });

  it('returns 401 for unauthenticated media request', async () => {
    const res = await router.handle({
      method: 'GET',
      path: '/api/media',
      session: null,
    });
    expect(res.status).toBe(401);
  });
});

describe('API Router — existing campaign routes still work', () => {
  let router: ReturnType<typeof createApiRouter>;

  beforeEach(() => {
    router = createApiRouter({
      campaignsModule: createCampaignsModule(),
    });
  });

  it('GET /api/campaigns returns campaign list', async () => {
    const res = await router.handle({
      method: 'GET',
      path: '/api/campaigns',
      session: authedSession,
    });
    expect(res.status).toBe(200);
    expect(res.body.campaigns).toBeDefined();
  });

  it('returns 404 for unknown route', async () => {
    const res = await router.handle({
      method: 'GET',
      path: '/api/unknown',
      session: authedSession,
    });
    expect(res.status).toBe(404);
  });
});

describe('API Router — background processing hooks', () => {
  it('kicks the background processor after a successful campaign launch', async () => {
    const campaignsModule = createCampaignsModule();
    const kick = vi.fn().mockResolvedValue(undefined);
    const router = createApiRouter({
      campaignsModule,
      backgroundProcessor: { kick },
    });

    const createResponse = await router.handle({
      method: 'POST',
      path: '/api/campaigns',
      session: authedSession,
      body: { title: 'Launchable campaign', videoAssetId: 'video-1' },
    });
    const campaignId = createResponse.body.campaign.id;

    await router.handle({
      method: 'POST',
      path: `/api/campaigns/${campaignId}/targets`,
      session: authedSession,
      body: {
        channelId: 'channel-1',
        videoTitle: 'Video title',
        videoDescription: 'Video description',
      },
    });

    await router.handle({
      method: 'POST',
      path: `/api/campaigns/${campaignId}/ready`,
      session: authedSession,
    });

    const launchResponse = await router.handle({
      method: 'POST',
      path: `/api/campaigns/${campaignId}/launch`,
      session: authedSession,
    });

    expect(launchResponse.status).toBe(200);
    expect(kick).toHaveBeenCalledTimes(1);
  });

  it('kicks the background processor after a successful target retry', async () => {
    const campaignsModule = createCampaignsModule();
    const kick = vi.fn().mockResolvedValue(undefined);
    const router = createApiRouter({
      campaignsModule,
      backgroundProcessor: { kick },
    });

    const { campaign } = await campaignsModule.campaignService.createCampaign({
      title: 'Retryable campaign',
      videoAssetId: 'video-2',
    });

    const { target } = await campaignsModule.campaignService.addTarget(campaign.id, {
      channelId: 'channel-2',
      videoTitle: 'Video title',
      videoDescription: 'Video description',
    });

    await campaignsModule.campaignService.markReady(campaign.id);
    await campaignsModule.launchService.launchCampaign(campaign.id);

    const jobs = await campaignsModule.jobService.getJobsForTarget(target.id);
    const job = jobs[0];
    await campaignsModule.jobService.markFailed(job.id, 'Upload failed');
    await campaignsModule.campaignService.updateTargetStatus(campaign.id, target.id, 'erro', {
      errorMessage: 'Upload failed',
    });

    const retryResponse = await router.handle({
      method: 'POST',
      path: `/api/campaigns/${campaign.id}/targets/${target.id}/retry`,
      session: authedSession,
    });

    expect(retryResponse.status).toBe(200);
    expect(kick).toHaveBeenCalledTimes(1);
  });
});

describe('API Router - account plan routes', () => {
  let router: ReturnType<typeof createApiRouter>;
  let accountPlanService: AccountPlanService;

  beforeEach(() => {
    accountPlanService = new AccountPlanService();
    const accountPlanController = new AccountPlanController(accountPlanService, new SessionGuard());
    router = createApiRouter({
      campaignsModule: createCampaignsModule({ accountPlanService }),
      accountPlanController,
    });
  });

  it('GET /api/account/plan returns the current plan summary', async () => {
    const res = await router.handle({
      method: 'GET',
      path: '/api/account/plan',
      session: authedSession,
    });

    expect(res.status).toBe(200);
    expect(res.body.account.plan).toBe('FREE');
    expect(res.body.account.maxTokens).toBe(150);
  });

  it('POST /api/account/plan/visit grants daily tokens once per day', async () => {
    const firstRes = await router.handle({
      method: 'POST',
      path: '/api/account/plan/visit',
      session: authedSession,
    });

    const secondRes = await router.handle({
      method: 'POST',
      path: '/api/account/plan/visit',
      session: authedSession,
    });

    expect(firstRes.status).toBe(200);
    expect(firstRes.body.claimed).toBe(true);
    expect(firstRes.body.grantedTokens).toBe(15);
    expect(firstRes.body.account.tokens).toBe(165);
    expect(secondRes.status).toBe(200);
    expect(secondRes.body.claimed).toBe(false);
    expect(secondRes.body.account.tokens).toBe(165);
  });

  it('POST /api/account/plan/select updates the current plan', async () => {
    const res = await router.handle({
      method: 'POST',
      path: '/api/account/plan/select',
      session: authedSession,
      body: { plan: 'PRO' },
    });

    expect(res.status).toBe(200);
    expect(res.body.account.plan).toBe('PRO');
    expect(res.body.account.allowedPlatforms).toEqual(['youtube', 'tiktok', 'instagram']);
  });
});
