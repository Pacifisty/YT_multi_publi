import { describe, it, expect, beforeEach } from 'vitest';
import {
  AccountsController,
  type AccountsRequest,
} from '../../apps/api/src/accounts/accounts.controller';
import {
  AccountsService,
  type ConnectedAccountRecord,
} from '../../apps/api/src/accounts/accounts.service';
import { TokenCryptoService } from '../../apps/api/src/common/crypto/token-crypto.service';
import { SessionGuard } from '../../apps/api/src/auth/session.guard';
import type { YouTubeChannelsListResult } from '../../apps/api/src/integrations/youtube/youtube-channels.service';

const TEST_KEY = '12345678901234567890123456789012';

function createTokenCrypto(): TokenCryptoService {
  return new TokenCryptoService({ OAUTH_TOKEN_KEY: TEST_KEY });
}

function createConnectedAccount(
  crypto: TokenCryptoService,
  overrides: Partial<ConnectedAccountRecord> = {},
): ConnectedAccountRecord {
  return {
    id: 'acct-1',
    ownerEmail: 'admin@test.com',
    provider: 'google',
    googleSubject: 'google-sub-1',
    email: 'ops@example.com',
    displayName: 'Ops User',
    accessTokenEnc: crypto.encrypt('access-token'),
    refreshTokenEnc: crypto.encrypt('refresh-token'),
    scopes: ['https://www.googleapis.com/auth/youtube.readonly'],
    tokenExpiresAt: new Date(Date.now() + 3600_000).toISOString(),
    status: 'connected',
    connectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const MOCK_CHANNELS: YouTubeChannelsListResult = {
  channels: [
    { channelId: 'UC_ch1', title: 'Channel 1', handle: '@ch1', thumbnailUrl: 'https://yt.com/1' },
  ],
};

function authedRequest(overrides: Partial<AccountsRequest> = {}): AccountsRequest {
  return {
    session: { adminUser: { email: 'admin@test.com', authenticatedAt: new Date().toISOString() } },
    ...overrides,
  };
}

function unauthedRequest(overrides: Partial<AccountsRequest> = {}): AccountsRequest {
  return { session: null, ...overrides };
}

describe('AccountsController', () => {
  let crypto: TokenCryptoService;

  beforeEach(() => {
    crypto = createTokenCrypto();
  });

  describe('listAccounts', () => {
    it('returns 401 for unauthenticated request', async () => {
      const service = new AccountsService({ tokenCryptoService: crypto });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.listAccounts(unauthedRequest());
      expect(res.status).toBe(401);
    });

    it('returns empty list initially', async () => {
      const accounts: ConnectedAccountRecord[] = [];
      const service = new AccountsService({
        tokenCryptoService: crypto,
        listConnectedAccounts: async () => accounts,
      });
      const controller = new AccountsController(service, new SessionGuard());

      const res = await controller.listAccounts(authedRequest());
      expect(res.status).toBe(200);
      expect(res.body.accounts).toEqual([]);
    });

    it('returns stored accounts', async () => {
      const account = createConnectedAccount(crypto);
      const service = new AccountsService({
        tokenCryptoService: crypto,
        listConnectedAccounts: async () => [account],
      });
      const controller = new AccountsController(service, new SessionGuard());

      const res = await controller.listAccounts(authedRequest());
      expect(res.status).toBe(200);
      expect(res.body.accounts).toHaveLength(1);
      expect(res.body.accounts[0].provider).toBe('google');
    });
  });

  describe('getAccount', () => {
    it('returns 401 for unauthenticated request', async () => {
      const service = new AccountsService({ tokenCryptoService: crypto });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.getAccount(unauthedRequest({ params: { accountId: 'x' } }));
      expect(res.status).toBe(401);
    });

    it('returns 404 for nonexistent account', async () => {
      const service = new AccountsService({
        tokenCryptoService: crypto,
        getConnectedAccount: async () => null,
      });
      const controller = new AccountsController(service, new SessionGuard());

      const res = await controller.getAccount(authedRequest({ params: { accountId: 'nonexistent' } }));
      expect(res.status).toBe(404);
    });

    it('returns account by id', async () => {
      const account = createConnectedAccount(crypto);
      const service = new AccountsService({
        tokenCryptoService: crypto,
        getConnectedAccount: async (id: string) => (id === account.id ? account : null),
      });
      const controller = new AccountsController(service, new SessionGuard());

      const res = await controller.getAccount(authedRequest({ params: { accountId: account.id } }));
      expect(res.status).toBe(200);
      expect(res.body.account!.id).toBe(account.id);
    });

    it('returns 400 if accountId is missing', async () => {
      const service = new AccountsService({ tokenCryptoService: crypto });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.getAccount(authedRequest({}));
      expect(res.status).toBe(400);
    });
  });

  describe('getChannels', () => {
    it('returns 401 for unauthenticated request', async () => {
      const service = new AccountsService({ tokenCryptoService: crypto });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.getChannels(unauthedRequest({ params: { accountId: 'x' } }));
      expect(res.status).toBe(401);
    });

    it('returns 400 if accountId is missing', async () => {
      const service = new AccountsService({ tokenCryptoService: crypto });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.getChannels(authedRequest({}));
      expect(res.status).toBe(400);
    });

    it('returns channels for an account', async () => {
      const account = createConnectedAccount(crypto);
      const service = new AccountsService({
        tokenCryptoService: crypto,
        getConnectedAccount: async (id: string) => (id === account.id ? account : null),
        youtubeChannelsService: { listMineChannels: async () => MOCK_CHANNELS },
      });
      await service.syncChannelsForAccount(account);

      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.getChannels(authedRequest({ params: { accountId: account.id } }));
      expect(res.status).toBe(200);
      expect(res.body.channels).toHaveLength(1);
    });
  });

  describe('toggleChannel', () => {
    it('returns 401 for unauthenticated request', async () => {
      const service = new AccountsService({ tokenCryptoService: crypto });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.toggleChannel(
        unauthedRequest({ params: { channelId: 'x' }, body: { isActive: false } }),
      );
      expect(res.status).toBe(401);
    });

    it('returns 400 if channelId is missing', async () => {
      const service = new AccountsService({ tokenCryptoService: crypto });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.toggleChannel(authedRequest({ body: { isActive: false } }));
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid body', async () => {
      const service = new AccountsService({ tokenCryptoService: crypto });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.toggleChannel(
        authedRequest({ params: { channelId: 'ch1' }, body: { wrong: true } }),
      );
      expect(res.status).toBe(400);
    });

    it('returns 404 for nonexistent channel', async () => {
      const service = new AccountsService({ tokenCryptoService: crypto });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.toggleChannel(
        authedRequest({ params: { channelId: 'nonexistent' }, body: { isActive: false } }),
      );
      expect(res.status).toBe(404);
    });

    it('toggles a channel off', async () => {
      const account = createConnectedAccount(crypto);
      const service = new AccountsService({
        tokenCryptoService: crypto,
        getConnectedAccount: async (id: string) => (id === account.id ? account : null),
        youtubeChannelsService: { listMineChannels: async () => MOCK_CHANNELS },
      });
      const channels = await service.syncChannelsForAccount(account);

      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.toggleChannel(
        authedRequest({ params: { channelId: channels[0].id }, body: { isActive: false } }),
      );
      expect(res.status).toBe(200);
      expect(res.body.channel!.isActive).toBe(false);
    });
  });

  describe('disconnectAccount', () => {
    it('returns 401 for unauthenticated request', async () => {
      const service = new AccountsService({ tokenCryptoService: crypto });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.disconnectAccount(
        unauthedRequest({ params: { accountId: 'x' }, body: { confirm: 'DISCONNECT' } }),
      );
      expect(res.status).toBe(401);
    });

    it('returns 400 if accountId is missing', async () => {
      const service = new AccountsService({ tokenCryptoService: crypto });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.disconnectAccount(
        authedRequest({ body: { confirm: 'DISCONNECT' } }),
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 without confirmation body', async () => {
      const service = new AccountsService({ tokenCryptoService: crypto });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.disconnectAccount(
        authedRequest({ params: { accountId: 'acc1' }, body: {} }),
      );
      expect(res.status).toBe(400);
    });

    it('disconnects with valid confirmation', async () => {
      const account = createConnectedAccount(crypto, { id: 'acc1' });
      const service = new AccountsService({
        tokenCryptoService: crypto,
        getConnectedAccount: async (id: string) => (id === account.id ? account : null),
      });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.disconnectAccount(
        authedRequest({ params: { accountId: account.id }, body: { confirm: 'DISCONNECT' } }),
      );
      expect(res.status).toBe(200);
      expect(res.body.disconnected).toBe(true);
    });
  });

  describe('deleteAccount', () => {
    it('returns 401 for unauthenticated request', async () => {
      const service = new AccountsService({ tokenCryptoService: crypto });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.deleteAccount(
        unauthedRequest({ params: { accountId: 'x' }, body: { confirm: 'DELETE' } }),
      );
      expect(res.status).toBe(401);
    });

    it('returns 400 if accountId is missing', async () => {
      const service = new AccountsService({ tokenCryptoService: crypto });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.deleteAccount(
        authedRequest({ body: { confirm: 'DELETE' } }),
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 without confirmation body', async () => {
      const service = new AccountsService({ tokenCryptoService: crypto });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.deleteAccount(
        authedRequest({ params: { accountId: 'acc1' }, body: {} }),
      );
      expect(res.status).toBe(400);
    });

    it('returns 404 for unknown account', async () => {
      const service = new AccountsService({
        tokenCryptoService: crypto,
        getConnectedAccount: async () => null,
      });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.deleteAccount(
        authedRequest({ params: { accountId: 'missing' }, body: { confirm: 'DELETE' } }),
      );
      expect(res.status).toBe(404);
    });

    it('deletes an existing account with valid confirmation', async () => {
      const account = createConnectedAccount(crypto);
      const service = new AccountsService({
        tokenCryptoService: crypto,
        getConnectedAccount: async (id: string) => (id === account.id ? account : null),
        deleteConnectedAccount: async (id: string) => id === account.id,
      });
      const controller = new AccountsController(service, new SessionGuard());

      const res = await controller.deleteAccount(
        authedRequest({ params: { accountId: account.id }, body: { confirm: 'DELETE' } }),
      );
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
      expect(res.body.removedChannels).toBe(0);
    });

    it('returns 409 when the account cannot be deleted because channels are in campaigns', async () => {
      const account = createConnectedAccount(crypto);
      const service = new AccountsService({
        tokenCryptoService: crypto,
        getConnectedAccount: async (id: string) => (id === account.id ? account : null),
        channelStore: {
          upsert: async () => {
            throw new Error('not implemented');
          },
          findByAccountId: async () => [{
            id: 'ch-1',
            connectedAccountId: account.id,
            youtubeChannelId: 'UC_blocked',
            title: 'Blocked Channel',
            isActive: true,
            lastSyncedAt: new Date().toISOString(),
          }],
          findById: async () => null,
          update: async () => null,
          delete: async () => {
            const error = new Error('Foreign key constraint failed');
            (error as Error & { code?: string }).code = 'P2003';
            throw error;
          },
          deactivateAllForAccount: async () => undefined,
        },
      });
      const controller = new AccountsController(service, new SessionGuard());

      const res = await controller.deleteAccount(
        authedRequest({ params: { accountId: account.id }, body: { confirm: 'DELETE' } }),
      );
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/campaign/i);
    });
  });

  describe('startGoogleOauth', () => {
    it('returns 401 for unauthenticated request', async () => {
      const service = new AccountsService({ tokenCryptoService: crypto });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.startGoogleOauth(unauthedRequest());
      expect(res.status).toBe(401);
    });

    it('returns 200 with redirect URL', async () => {
      const service = new AccountsService({
        tokenCryptoService: crypto,
        createAuthorizationRedirect: async () => 'https://accounts.google.com/o/oauth2/auth?client_id=test',
      });
      const controller = new AccountsController(service, new SessionGuard());

      const res = await controller.startGoogleOauth(authedRequest());
      expect(res.status).toBe(200);
      expect(res.body.redirectUrl).toContain('google');
    });

    it('returns 500 when oauth start throws', async () => {
      const service = new AccountsService({
        tokenCryptoService: crypto,
        createAuthorizationRedirect: async () => {
          throw new Error('Google OAuth env is incomplete');
        },
      });
      const controller = new AccountsController(service, new SessionGuard());

      const res = await controller.startGoogleOauth(authedRequest());
      expect(res.status).toBe(500);
      expect(res.body.error).toContain('Google OAuth env is incomplete');
    });
  });

  describe('startYouTubeOauth', () => {
    it('returns 200 with redirect URL', async () => {
      const service = new AccountsService({
        tokenCryptoService: crypto,
        createAuthorizationRedirect: async () => 'https://accounts.google.com/o/oauth2/auth?client_id=test',
      });
      const controller = new AccountsController(service, new SessionGuard());

      const res = await controller.startYouTubeOauth(authedRequest());
      expect(res.status).toBe(200);
      expect(res.body.redirectUrl).toContain('google');
    });
  });

  describe('startInstagramOauth', () => {
    it('returns 200 with redirect URL', async () => {
      const service = new AccountsService({
        tokenCryptoService: crypto,
        instagramOauthService: {
          createAuthorizationRedirect: async () => 'https://www.instagram.com/oauth/authorize?client_id=test',
          validateCallbackState: () => true,
          exchangeCodeForTokens: async () => ({
            accessToken: 'ig-token',
            scopes: ['instagram_business_basic'],
            tokenExpiresAt: null,
            profile: {
              providerSubject: 'ig-user-1',
              displayName: 'Instagram User',
            },
          }),
        } as any,
      });
      const controller = new AccountsController(service, new SessionGuard());

      const res = await controller.startInstagramOauth(authedRequest());
      expect(res.status).toBe(200);
      expect(res.body.redirectUrl).toContain('instagram.com');
    });
  });

  describe('startTikTokOauth', () => {
    it('returns 200 with redirect URL', async () => {
      const service = new AccountsService({
        tokenCryptoService: crypto,
        tikTokOauthService: {
          createAuthorizationRedirect: async () => 'https://www.tiktok.com/v2/auth/authorize/?client_key=test',
          validateCallbackState: () => true,
          exchangeCodeForTokens: async () => ({
            accessToken: 'tt-token',
            scopes: ['user.info.basic'],
            tokenExpiresAt: null,
            profile: {
              providerSubject: 'tt-user-1',
              displayName: 'TikTok User',
            },
          }),
        } as any,
      });
      const controller = new AccountsController(service, new SessionGuard());

      const res = await controller.startTikTokOauth(authedRequest());
      expect(res.status).toBe(200);
      expect(res.body.redirectUrl).toContain('tiktok.com');
    });
  });

  describe('syncChannels', () => {
    it('returns 401 for unauthenticated request', async () => {
      const service = new AccountsService({ tokenCryptoService: crypto });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.syncChannels(unauthedRequest({ params: { accountId: 'x' } }));
      expect(res.status).toBe(401);
    });

    it('returns 400 if accountId is missing', async () => {
      const service = new AccountsService({ tokenCryptoService: crypto });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.syncChannels(authedRequest({}));
      expect(res.status).toBe(400);
    });

    it('returns 404 for nonexistent account', async () => {
      const service = new AccountsService({
        tokenCryptoService: crypto,
        getConnectedAccount: async () => null,
      });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.syncChannels(authedRequest({ params: { accountId: 'missing' } }));
      expect(res.status).toBe(404);
    });

    it('syncs channels for an existing account', async () => {
      const account = createConnectedAccount(crypto);
      const service = new AccountsService({
        tokenCryptoService: crypto,
        getConnectedAccount: async (id: string) => (id === account.id ? account : null),
        youtubeChannelsService: { listMineChannels: async () => MOCK_CHANNELS },
      });
      const controller = new AccountsController(service, new SessionGuard());

      const res = await controller.syncChannels(authedRequest({ params: { accountId: account.id } }));
      expect(res.status).toBe(200);
      expect(res.body.channels).toHaveLength(1);
      expect(res.body.sync?.channelCount).toBe(1);
    });

    it('returns a brand-account hint when sync finds zero channels', async () => {
      const account = createConnectedAccount(crypto);
      const service = new AccountsService({
        tokenCryptoService: crypto,
        getConnectedAccount: async (id: string) => (id === account.id ? account : null),
        youtubeChannelsService: { listMineChannels: async () => ({ channels: [] }) },
      });
      const controller = new AccountsController(service, new SessionGuard());

      const res = await controller.syncChannels(authedRequest({ params: { accountId: account.id } }));
      expect(res.status).toBe(200);
      expect(res.body.channels).toHaveLength(0);
      expect(res.body.sync?.channelCount).toBe(0);
      expect(res.body.sync?.message).toContain('Brand Accounts');
    });
  });

  describe('handleGoogleOauthCallback', () => {
    it('returns 401 for unauthenticated request', async () => {
      const service = new AccountsService({ tokenCryptoService: crypto });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.handleGoogleOauthCallback(
        unauthedRequest({ query: { code: 'c', state: 's' } }),
      );
      expect(res.status).toBe(401);
    });

    it('returns 400 if code or state is missing', async () => {
      const service = new AccountsService({ tokenCryptoService: crypto });
      const controller = new AccountsController(service, new SessionGuard());
      const res = await controller.handleGoogleOauthCallback(authedRequest({ query: {} }));
      expect(res.status).toBe(400);
    });

    it('returns 400 on invalid OAuth state', async () => {
      const service = new AccountsService({
        tokenCryptoService: crypto,
        handleOauthCallback: async () => ({ ok: false as const, reason: 'INVALID_STATE' as const }),
      });
      const controller = new AccountsController(service, new SessionGuard());

      const res = await controller.handleGoogleOauthCallback(
        authedRequest({ query: { code: 'c', state: 'bad' } }),
      );
      expect(res.status).toBe(400);
    });

    it('returns 200 with account on success', async () => {
      const account = createConnectedAccount(crypto);
      const syncChannelsForAccount = async () => MOCK_CHANNELS.channels.map((channel, index) => ({
        id: `ch-${index + 1}`,
        connectedAccountId: account.id,
        youtubeChannelId: channel.channelId,
        title: channel.title,
        handle: channel.handle,
        thumbnailUrl: channel.thumbnailUrl,
        isActive: true,
        lastSyncedAt: new Date().toISOString(),
      }));
      const service = new AccountsService({
        tokenCryptoService: crypto,
        handleOauthCallback: async () => ({ ok: true as const, account }),
        youtubeChannelsService: { listMineChannels: async () => MOCK_CHANNELS },
      });
      service.syncChannelsForAccount = syncChannelsForAccount;
      const controller = new AccountsController(service, new SessionGuard());

      const res = await controller.handleGoogleOauthCallback(
        authedRequest({ query: { code: 'valid', state: 'valid' } }),
      );
      expect(res.status).toBe(200);
      expect(res.body.account!.id).toBe(account.id);
      expect(res.body.sync?.channelCount).toBe(1);
    });

    it('returns 500 when oauth callback throws', async () => {
      const service = new AccountsService({
        tokenCryptoService: crypto,
        handleOauthCallback: async () => {
          throw new Error('token exchange failed');
        },
      });
      const controller = new AccountsController(service, new SessionGuard());

      const res = await controller.handleGoogleOauthCallback(
        authedRequest({ query: { code: 'valid', state: 'valid' } }),
      );
      expect(res.status).toBe(500);
      expect(res.body.error).toContain('token exchange failed');
    });
  });

  describe('handleYouTubeOauthCallback', () => {
    it('returns 200 with account on success', async () => {
      const account = createConnectedAccount(crypto);
      const service = new AccountsService({
        tokenCryptoService: crypto,
        handleOauthCallback: async () => ({ ok: true as const, account }),
      });
      service.syncChannelsForAccount = async () => [];
      const controller = new AccountsController(service, new SessionGuard());

      const res = await controller.handleYouTubeOauthCallback(
        authedRequest({ query: { code: 'valid', state: 'valid' } }),
      );
      expect(res.status).toBe(200);
      expect(res.body.account!.id).toBe(account.id);
    });
  });

  describe('handleInstagramOauthCallback', () => {
    it('returns 200 with account on success without sync summary', async () => {
      const account = createConnectedAccount(crypto, {
        id: 'ig-acct-1',
        provider: 'instagram',
        providerSubject: 'ig-user-1',
        googleSubject: 'ig-user-1',
        displayName: 'Instagram User',
        email: undefined,
      });
      const service = new AccountsService({
        tokenCryptoService: crypto,
        instagramOauthService: {
          createAuthorizationRedirect: async () => 'https://www.instagram.com/oauth/authorize?client_id=test&state=valid',
          validateCallbackState: () => true,
          exchangeCodeForTokens: async () => ({
            accessToken: 'ig-token',
            scopes: ['instagram_business_basic'],
            tokenExpiresAt: null,
            profile: {
              providerSubject: 'ig-user-1',
              displayName: 'Instagram User',
            },
          }),
        } as any,
      });
      service.createPersistenceRecord = () => account;
      const controller = new AccountsController(service, new SessionGuard());

      const res = await controller.handleInstagramOauthCallback(
        authedRequest({ query: { code: 'valid', state: 'valid' } }),
      );
      expect(res.status).toBe(200);
      expect(res.body.account!.provider).toBe('instagram');
      expect(res.body.sync).toBeUndefined();
    });
  });

  describe('handleTikTokOauthCallback', () => {
    it('returns 200 with account on success without sync summary', async () => {
      const account = createConnectedAccount(crypto, {
        id: 'tt-acct-1',
        provider: 'tiktok',
        providerSubject: 'tt-user-1',
        googleSubject: 'tt-user-1',
        displayName: 'TikTok User',
        email: undefined,
      });
      const service = new AccountsService({
        tokenCryptoService: crypto,
        tikTokOauthService: {
          createAuthorizationRedirect: async () => 'https://www.tiktok.com/v2/auth/authorize/?client_key=test&state=valid',
          validateCallbackState: () => true,
          exchangeCodeForTokens: async () => ({
            accessToken: 'tt-token',
            scopes: ['user.info.basic'],
            tokenExpiresAt: null,
            profile: {
              providerSubject: 'tt-user-1',
              displayName: 'TikTok User',
            },
          }),
        } as any,
      });
      service.createPersistenceRecord = () => account;
      const controller = new AccountsController(service, new SessionGuard());

      const res = await controller.handleTikTokOauthCallback(
        authedRequest({ query: { code: 'valid', state: 'valid' } }),
      );
      expect(res.status).toBe(200);
      expect(res.body.account!.provider).toBe('tiktok');
      expect(res.body.sync).toBeUndefined();
    });
  });
});
