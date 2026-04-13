import { describe, it, expect, beforeEach } from 'vitest';
import { createApiRouter, type ApiRequest } from '../../apps/api/src/router';
import { createCampaignsModule } from '../../apps/api/src/campaigns/campaigns.module';
import { AccountsController } from '../../apps/api/src/accounts/accounts.controller';
import { AccountsService } from '../../apps/api/src/accounts/accounts.service';
import { MediaController } from '../../apps/api/src/media/media.controller';
import { MediaService, InMemoryMediaRepository } from '../../apps/api/src/media/media.service';
import { SessionGuard } from '../../apps/api/src/auth/session.guard';
import { TokenCryptoService } from '../../apps/api/src/common/crypto/token-crypto.service';
import type { ConnectedAccountRecord } from '../../apps/api/src/accounts/accounts.service';

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
